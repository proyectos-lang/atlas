# ATLAS — Analítica de competencias transversales

Reemplaza el reporte de Power BI `proyectoatlas.pbix` por una aplicación web con
autenticación por perfiles y un agente de recomendaciones pedagógicas.

## Requisitos

- Node 20+ (probado en 24.16)
- Un proyecto de Supabase

## Puesta en marcha

> **El archivo de datos no viaja en el repositorio.** `datos/*.xlsx` está en
> `.gitignore` a propósito: contiene registros de estudiantes y este repositorio
> es público. Pide `Base_Datos_ATLAS_Moodle_Datos_Ensayo.xlsx` al responsable del
> proyecto y colócalo en `datos/` antes del paso 4.

1. `npm install`
2. Copiar `.env.local.example` a `.env.local` y completar las claves.
3. Aplicar las migraciones (ver abajo).
4. `npm run seed` — carga el Excel de `datos/`.
5. `npm run seed:verificar` — comprueba volúmenes y anclajes.
6. `npm run dev`

## Migraciones

Ejecutar **en orden** desde el SQL Editor de Supabase:

| # | Archivo | Qué crea |
|---|---|---|
| 1 | `supabase/migraciones/00_esquema.sql` | esquema `atlas` + dimensiones |
| 2 | `supabase/migraciones/01_hechos.sql` | foros, colaboración, logs, evaluaciones, resultados |
| 3 | `supabase/migraciones/02_rubrica_parametros.sql` | rúbrica (3 tablas), parámetros, catálogo |
| 4 | `supabase/migraciones/03_recomendaciones_perfiles.sql` | recomendaciones y perfiles |
| 5 | `supabase/migraciones/04_seed_rubrica_parametros.sql` | semillas deterministas |
| 6 | `supabase/migraciones/06_perfil_egreso.sql` | perfil de egreso por programa |

> La migración 04 depende de que `usuarios` y `semanas` ya tengan datos.
> Ejecutarla **después** de `npm run seed`.

Con `DATABASE_URL` configurada se pueden aplicar todas con `npm run migrar`.

## Decisiones que conviene conocer

- **Esquema `atlas`, nunca `public`.** RLS deshabilitado a propósito: el control de
  acceso se aplica en el servidor con el `Alcance` del perfil. Ninguna consulta
  se ejecuta sin alcance.
- **La service role key nunca llega al cliente.** `lib/supabase/servidor.ts` importa
  `server-only`, así que un import desde un componente cliente rompe la compilación.
- **`rubrica` y `parametros` no son datos de origen.** No están en el Excel y no deben
  estarlo: son configuración y evaluación editables desde la aplicación. La rúbrica
  nace como semilla (`es_semilla = true`) y el docente la reemplaza fila por fila.
- **La semilla de rúbrica es determinista, sin aleatoriedad.** Los valores de referencia
  sólo cuadran si se reproducen exactamente esos números.
- **`round()` debe operar sobre `numeric`.** Con redondeo bancario (float8) 26 de las
  1296 celdas bajan un punto y NA, EA, TD y NIA dejan de cuadrar.
- **La hoja `KPIs_Competencias` no es fuente de verdad.** No concuerda con los datos
  crudos (correlación ≈ 0); se carga aparte sólo para pruebas comparativas.

## Valores de referencia

El motor debe reproducir estas cifras sobre el conjunto completo sin filtros:

| Indicador | Valor |
|---|---|
| Competencia Transversal Global | 73,4 % |
| Índice de Trabajo en Equipo | 66,7 % |
| Índice de Aprendizaje Autónomo | 83,6 % |
| Índice de Comunicación Efectiva | 74,9 % |
| Índice de Pensamiento Crítico | 74,1 % |
| Índice de Resolución de Problemas | 68,0 % |
| Índice de Logro de Resultados de Aprendizaje | 57,8 % |
| Embudo | 36 · 36 · 36 · 24 · 11 |

Anclajes de la semilla de rúbrica (1296 filas):

| KPI | suma obtenido | suma máximo | indicador |
|---|---|---|---|
| NA | 1512 | 2160 | 70,00 % |
| NS | 15660 | 21600 | 72,50 % |
| EA | 810 | 1080 | 75,00 % |
| TD | 850 | 1080 | 78,70 % |
| NIA | 898 | 1296 | 69,29 % |
| UEA | 616 | 864 | 71,30 % |

## Perfil de egreso

Cada programa —cada fila de `universidades`, que ya es un par universidad +
programa— puede tener un perfil de egreso: el texto del documento curricular
que declara qué debe saber hacer quien termina. Se configura en
**Administración → Perfil de egreso**, sólo el administrador.

No es un dato más del tablero: entra en el contexto del agente de IA, que lo
recibe rotulado como documento curricular junto a los indicadores del
estudiante. La regla que se le impone es que la acción propuesta sirva a
alguna capacidad que el perfil declara, y que la justificación la nombre en
los términos del propio perfil. Los indicadores dicen dónde está la carencia;
el perfil, hacia qué se la corrige.

Un programa sin perfil de egreso no rompe nada: el agente sigue trabajando
sólo con los indicadores, como hasta ahora. Desactivarlo (sin borrarlo) lo
saca del contexto.

## Acerca de los indicadores

`/acerca-de`, accesible a todos los roles: cómo se calcula cada indicador, en
dos niveles. La prosa dice qué mide y cómo leerlo; «Ver el cálculo» despliega
la fórmula, el origen del dato y el parámetro configurable. Incluye las cuatro
reglas, la excepción de CPP, los criterios del embudo y los valores de
referencia.

El texto vive en `lib/kpi/metodologia.ts` y es **documentación, no motor**: si
se cambia una fórmula en `05_vistas_kpi.sql` hay que cambiarla también ahí.
`pruebas/metodologia.test.ts` comprueba que no falte ningún indicador ni se
documenten códigos inexistentes, pero no puede verificar que la prosa describa
bien la fórmula.

## Motor de indicadores

El cálculo pesado vive en funciones de Postgres (`supabase/migraciones/05_vistas_kpi.sql`);
`lib/kpi/indicadores.ts` sólo filtra por alcance y agrega.

| Función | Qué devuelve |
|---|---|
| `atlas.kpi_estudiante(semanas)` | los 22 sub-indicadores por estudiante, ya truncados |
| `atlas.kpi_indice(semanas)` | los cinco índices y el global, por estudiante |
| `atlas.kpi_ilo()` | ILRA, TLC, IBA y NLA por estudiante |
| `atlas.kpi_embudo(univ, cursos, usuarios)` | las cinco etapas de progresión |

### Las cuatro reglas

1. Los indicadores de razón se calculan **por estudiante** y luego se promedian.
   Nunca suma del grupo entre esperado del grupo.
2. El truncamiento en 100 se aplica **por estudiante, antes** de promediar.
   RIP satura en 35 de 36 estudiantes, así que el orden cambia el resultado.
3. Los valores esperados se **prorratean**: `factor = semanas_ámbito / semanas_curso`.
   Sin esto, filtrar una semana hundía el Índice de Trabajo en Equipo de 66 % a 25 %.
   **CPP es la excepción**: se divide entre las 5 actividades programadas, sin prorratear.
4. Todo en escala 0–100, salvo el Índice de Brecha de Aprendizaje, que va en **puntos**
   y puede ser negativo.

### Verificación

```bash
npm run motor            # calcula los indicadores y los compara con la referencia
npm run motor:contraste  # contrasta las vistas SQL con el cálculo de referencia
npm run test             # 120 pruebas
```

`motor:contraste` compara **estudiante por estudiante**. Son dos implementaciones
independientes de las mismas fórmulas: si coinciden y dan los valores de referencia,
el motor está bien. Hoy la mayor diferencia es 0,00000000.

### Detalles que costaron encontrar

- **`round()` sobre `numeric`, nunca `float8`.** Con redondeo bancario, 26 de las
  1296 celdas de rúbrica bajan un punto y cuatro criterios dejan de cuadrar.
- **División 0/0 al filtrar por semana.** Un estudiante sin actividad en la semana 1
  producía `NaN` en el Índice de Colaboración que contaminaba todo el índice.
  En el conjunto completo es invisible.
- **La etapa 5 del embudo es 11, no 22.** El 22 venía de una versión del modelo
  anterior a que la rúbrica tuviera dimensión semanal. El umbral sigue siendo
  CTG ≥ 75, coherente con el nivel Alto de la escala de dominio.
- **Los indicadores del agente devuelven `null`, no 0 %,** mientras no haya empezado
  el ciclo de revisión. Un 0 % afirmaría que se rechazó todo.
