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
| 7 | `supabase/migraciones/07_permisos_modulos.sql` | permisos de módulo por perfil |
| 8 | `supabase/migraciones/08_jerarquia.sql` | programas, grupos y alcance jerárquico |
| 9 | `supabase/migraciones/09_curriculo.sql` | modelo curricular macro-meso-micro |
| 10 | `supabase/migraciones/10_seed_competencias.sql` | semilla de competencias e indicadores |
| 11 | `supabase/migraciones/11_evidencias.sql` | fuentes de datos, mapeos y evidencias |
| 12 | `supabase/migraciones/12_motor_evidencias.sql` | motor de cálculo configurable |

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

## Fuentes de datos y evidencias

**El LMS es una fuente más, no un requisito.** Un curso presencial sin
ninguna herramienta digital registra evidencias por observación del docente y
produce los mismos indicadores que uno con Moodle.

```
fuente → dato → evidencia → indicador → competencia → resultado de aprendizaje
```

Se administra en **Administración → Fuentes de datos**. Dieciocho fuentes
sembradas en siete categorías: LMS, herramientas colaborativas, repositorios
de código, formularios, instrumentos pedagógicos, observación docente y
archivos estructurados.

`mapeos` declara qué variable de una fuente alimenta qué indicador, y con qué
transformación. Es lo que permite añadir una herramienta nueva sin tocar la
arquitectura: `GitHub · contribuciones → Participación → Trabajo en Equipo`.

`evidencias` es la tabla central. Cada fila conserva el **valor bruto** además
del transformado, para poder auditar la transformación o rehacerla si el
mapeo cambia. Toda carga masiva deja un lote reversible: un archivo mal
mapeado se revierte entero en vez de quedar mezclado con el resto.

Dos formas de ingreso: integración por API para las fuentes que la tienen, y
carga estructurada para el resto. La carga es **todo o nada** — si alguna fila
falla no se guarda ninguna y se listan los errores.

### El motor configurable

`atlas.calcular_indicador()` decide el cálculo leyendo la definición del
indicador, en vez de tener la fórmula escrita: promedio, suma sobre un valor
esperado, proporción sobre un umbral, conteo o rúbrica.

**Conserva las cuatro reglas** del motor anterior, porque no son detalles de
implementación sino decisiones metodológicas. La diferencia es que ahora cada
indicador decide si se trunca y si se prorratea.

**Convive con `kpi_estudiante()`, no lo reemplaza.** Mientras no haya
evidencias cargadas, las cifras verificadas las sigue produciendo el motor
anterior. Un indicador sin evidencias no devuelve 0 — devuelve nada, porque un
0 afirmaría que el estudiante fue medido y obtuvo cero.

## Modelo curricular

Trazabilidad macro → meso → micro, con la medición descompuesta:

```
Institución → Facultad → Programa              (macro)
  → Área → Línea → Semestre                     (meso)
    → Asignatura → Unidad → Actividad           (micro)
      → Resultado de aprendizaje → Competencia
        → Dimensión → Indicador
```

Se administra en **Administración → Competencias e indicadores**.

**Una competencia no se evalúa con una calificación general.** Se descompone
en dimensiones observables --comprensión del problema, descomposición,
depuración…-- y cada dimensión se mide con indicadores que declaran cómo se
agregan: promedio, suma sobre un valor esperado, proporción sobre un umbral,
conteo o rúbrica. El truncamiento y el prorrateo dejan de estar cableados en
SQL y pasan a ser configurables por indicador.

Las cinco competencias transversales vienen sembradas con sus dimensiones.
`student_outcome` declara la correspondencia ABET; una competencia
transversal **sin** Student Outcome es complementaria: se trabaja en el
programa pero no corresponde a ninguno directo. Aprendizaje Autónomo es el
caso, y hay una prueba que lo verifica.

Las migraciones 09 y 10 son **aditivas**: no tocan ninguna tabla de hechos ni
ninguna función del motor, y `pruebas/curriculo.test.ts` lo comprueba leyendo
el SQL. Por eso `npm run motor` sigue dando los mismos valores después de
aplicarlas.

## Jerarquía académica

`Universidad → Programa → Curso → Grupo → estudiantes`, con el docente
asignado al grupo.

Antes de la migración 08, `universidades` mezclaba institución y programa en
una fila: "Universidad A / Ingeniería de Sistemas" era **una** fila, y el
filtro de programa trabajaba con el texto de esa columna. Eso impedía que una
universidad tuviera varios programas. Ahora `programas` es una tabla propia y
`grupos` divide cada curso en secciones.

**La migración no toca ninguna tabla de hechos.** Foros, colaboración, logs,
evaluaciones, rúbrica y resultados siguen colgando de usuario y curso igual
que siempre, y por eso los valores de referencia no se mueven. Si tras
aplicarla `npm run motor` deja de dar 73,4 % y 36·36·36·24·11, algo salió mal.

El `Alcance` pasa de tres dimensiones a cinco. Un detalle que importa: un
coordinador **con programa asignado se ciñe al programa, no a la
universidad**. Ceñir sólo por universidad le mostraría los demás programas de
su institución en cuanto hubiera más de uno — una escalada de privilegios
silenciosa. `pruebas/jerarquia.test.ts` lo verifica.

Se administra desde **Administración → Jerarquía académica**: crear programas
y grupos, asignar el docente responsable de cada grupo y mover cursos entre
programas. El alcance de cada perfil (a qué programa o grupo se ciñe) se
asigna en **Perfiles de acceso**; son dos cosas distintas y la interfaz lo
advierte: asignar a alguien como docente de un grupo lo deja registrado como
responsable, pero no le concede acceso por sí solo.

El motor SQL no conoce programa ni grupo: `resolverJerarquia()` en
`lib/kpi/indicadores.ts` los traduce a la lista de estudiantes afectados
antes de consultar. Se hizo así a propósito, para no tocar
`05_vistas_kpi.sql` y arriesgar los valores de referencia.

## Permisos de módulo

El rol decide qué pantallas ve alguien por defecto; el administrador puede
ajustar esa lista perfil por perfil desde **Administración → Perfiles de
acceso**, al crear el perfil o después.

**Un módulo es una pantalla, no un permiso sobre datos.** Conceder
`/administrador` a un docente le muestra el tablero institucional, pero
poblado sólo con los datos de su curso: el `Alcance` sigue decidiendo qué
filas se consultan y no se toca aquí. La separación es deliberada y hay una
prueba que falla si alguien intenta derivar alcance de los módulos.

`perfiles.modulos` distingue tres estados, y confundir los dos últimos sería
grave:

- `null` — sin personalizar: usa las rutas de su rol. Es el estado de todos
  los perfiles anteriores a la migración 07, y por eso la columna no lleva
  `DEFAULT '{}'`.
- `[]` — ningún módulo: puede iniciar sesión pero no ve nada, y aterriza en
  `/sin-acceso`.
- `['/inicio', …]` — exactamente esos módulos.

Un administrador no puede quitarse a sí mismo el módulo de Administración:
perdería el acceso a la pantalla desde la que se arregla.

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
