-- ============================================================
-- ATLAS · 10 · Semilla de competencias, dimensiones e indicadores
-- ============================================================

-- Las cinco competencias transversales del modelo, descompuestas en
-- dimensiones observables y con un indicador por dimensión.
--
-- ESTO ES CONFIGURACIÓN EDITABLE, NO DATO DE ORIGEN. La semilla existe
-- para que el sistema arranque con algo utilizable; el docente la ajusta
-- desde la aplicación. Por eso todo va con `on conflict do nothing`:
-- ejecutar la migración dos veces nunca pisa lo que alguien ya cambió.
--
-- Correspondencia ABET: se declara en `student_outcome`. Una competencia
-- con `transversal = true` y `student_outcome` nulo es una competencia
-- transversal COMPLEMENTARIA, que el modelo trabaja pero que no
-- corresponde a ningún Student Outcome directo.

-- ---------- Competencias ----------

insert into atlas.competencias
  (codigo, nombre, descripcion, transversal, student_outcome, orden)
values
  ('CE', 'Comunicación Efectiva',
   'Expresa ideas con claridad y argumenta por escrito y en interacción con otros.',
   true, 'SO3', 1),
  ('PC', 'Pensamiento Crítico',
   'Analiza, sintetiza y evalúa alternativas antes de decidir, justificando con evidencia.',
   true, 'SO1', 2),
  ('RP', 'Resolución de Problemas',
   'Identifica problemas, diseña soluciones, las implementa y verifica que funcionen.',
   true, 'SO1', 3),
  ('TE', 'Trabajo en Equipo',
   'Contribuye al trabajo colectivo, coordina con otros y asume responsabilidades.',
   true, 'SO5', 4),
  -- Sin Student Outcome: es la transversal complementaria del modelo.
  ('AA', 'Aprendizaje Autónomo',
   'Regula su propio aprendizaje: constancia, uso de recursos y cumplimiento de plazos.',
   true, null, 5)
on conflict (codigo) do nothing;

-- ---------- Dimensiones ----------

-- Comunicación Efectiva
insert into atlas.dimensiones (codigo, nombre, descripcion, competencia_id, orden)
select v.codigo, v.nombre, v.descripcion, c.id, v.orden
from atlas.competencias c
cross join (values
  ('CE-CLA', 'Claridad',        'La idea se entiende sin releer.', 1),
  ('CE-ARG', 'Argumentación',   'Sostiene lo que afirma con razones.', 2),
  ('CE-INT', 'Interacción',     'Responde a otros y sostiene el intercambio.', 3),
  ('CE-RET', 'Retroalimentación','La devolución que da a sus pares es útil.', 4)
) as v(codigo, nombre, descripcion, orden)
where c.codigo = 'CE'
on conflict (codigo) do nothing;

-- Pensamiento Crítico
insert into atlas.dimensiones (codigo, nombre, descripcion, competencia_id, orden)
select v.codigo, v.nombre, v.descripcion, c.id, v.orden
from atlas.competencias c
cross join (values
  ('PC-ANA', 'Análisis',                'Descompone la situación en sus partes.', 1),
  ('PC-SIN', 'Síntesis',                'Integra ideas de varias fuentes.', 2),
  ('PC-EVA', 'Evaluación de alternativas','Compara opciones con criterios explícitos.', 3),
  ('PC-DEC', 'Toma de decisiones',      'Decide y justifica con evidencia.', 4)
) as v(codigo, nombre, descripcion, orden)
where c.codigo = 'PC'
on conflict (codigo) do nothing;

-- Resolución de Problemas (las siete del enunciado)
insert into atlas.dimensiones (codigo, nombre, descripcion, competencia_id, orden)
select v.codigo, v.nombre, v.descripcion, c.id, v.orden
from atlas.competencias c
cross join (values
  ('RP-COM', 'Comprensión del problema', 'Identifica qué se pide y qué restricciones hay.', 1),
  ('RP-DES', 'Descomposición',           'Parte el problema en subproblemas abordables.', 2),
  ('RP-ALT', 'Generación de alternativas','Propone más de un camino de solución.', 3),
  ('RP-IMP', 'Implementación',           'Lleva la solución propuesta a la práctica.', 4),
  ('RP-PRU', 'Pruebas',                  'Comprueba la solución con casos.', 5),
  ('RP-DEP', 'Depuración',               'Localiza y corrige los errores que encuentra.', 6),
  ('RP-VAL', 'Validación',               'Verifica que la solución resuelve el problema.', 7)
) as v(codigo, nombre, descripcion, orden)
where c.codigo = 'RP'
on conflict (codigo) do nothing;

-- Trabajo en Equipo (las seis del enunciado)
insert into atlas.dimensiones (codigo, nombre, descripcion, competencia_id, orden)
select v.codigo, v.nombre, v.descripcion, c.id, v.orden
from atlas.competencias c
cross join (values
  ('TE-PAR', 'Participación',       'Interviene en el trabajo del grupo.', 1),
  ('TE-CON', 'Contribución',        'Lo que aporta tiene peso en el resultado.', 2),
  ('TE-RES', 'Responsabilidades',   'Cumple lo que le corresponde y en plazo.', 3),
  ('TE-COO', 'Coordinación',        'Organiza el trabajo con los demás.', 4),
  ('TE-INT', 'Integración de aportes','Incorpora lo que aportan los otros.', 5),
  ('TE-COL', 'Colaboración',        'Ayuda a que el grupo avance, no sólo su parte.', 6)
) as v(codigo, nombre, descripcion, orden)
where c.codigo = 'TE'
on conflict (codigo) do nothing;

-- Aprendizaje Autónomo
insert into atlas.dimensiones (codigo, nombre, descripcion, competencia_id, orden)
select v.codigo, v.nombre, v.descripcion, c.id, v.orden
from atlas.competencias c
cross join (values
  ('AA-CON', 'Constancia',     'Trabaja de forma sostenida, no concentrada al final.', 1),
  ('AA-REC', 'Uso de recursos','Consulta los materiales disponibles.', 2),
  ('AA-PLA', 'Cumplimiento de plazos', 'Entrega cuando corresponde.', 3),
  ('AA-REG', 'Autorregulación','Ajusta su forma de estudiar según los resultados.', 4)
) as v(codigo, nombre, descripcion, orden)
where c.codigo = 'AA'
on conflict (codigo) do nothing;

-- ---------- Indicadores ----------

-- Uno por dimensión, con la agregación que corresponde a su naturaleza.
-- El docente añade o modifica desde la aplicación: estos son el punto de
-- partida, no una lista cerrada.
insert into atlas.indicadores
  (codigo, nombre, dimension_id, agregacion, umbral, escala, trunca_100, orden)
select
  d.codigo || '-I1',
  v.nombre,
  d.id,
  v.agregacion,
  v.umbral,
  'Porcentaje',
  true,
  1
from atlas.dimensiones d
join (values
  -- Comunicación Efectiva
  ('CE-CLA', 'Claridad del texto',                 'Promedio',   null),
  ('CE-ARG', 'Participaciones argumentadas',       'Proporcion', 70),
  ('CE-INT', 'Respuestas en interacción',          'Suma',       null),
  ('CE-RET', 'Calidad de la retroalimentación',    'Promedio',   null),
  -- Pensamiento Crítico (rúbrica docente)
  ('PC-ANA', 'Nivel de argumentación',             'Rubrica',    null),
  ('PC-SIN', 'Nivel de síntesis',                  'Rubrica',    null),
  ('PC-EVA', 'Alternativas evaluadas',             'Rubrica',    null),
  ('PC-DEC', 'Decisiones fundamentadas',           'Rubrica',    null),
  -- Resolución de Problemas
  ('RP-COM', 'Problemas identificados',            'Rubrica',    null),
  ('RP-DES', 'Subproblemas definidos',             'Rubrica',    null),
  ('RP-ALT', 'Alternativas propuestas',            'Conteo',     null),
  ('RP-IMP', 'Soluciones implementadas',           'Proporcion', 70),
  ('RP-PRU', 'Casos de prueba ejecutados',         'Conteo',     null),
  ('RP-DEP', 'Errores corregidos',                 'Conteo',     null),
  ('RP-VAL', 'Desempeño en problemas aplicados',   'Promedio',   null),
  -- Trabajo en Equipo
  ('TE-PAR', 'Tasa de participación',              'Suma',       null),
  ('TE-CON', 'Nivel de contribución',              'Promedio',   null),
  ('TE-RES', 'Cumplimiento de responsabilidades',  'Proporcion', 70),
  ('TE-COO', 'Coordinación con el grupo',          'Promedio',   null),
  ('TE-INT', 'Integración de aportes',             'Promedio',   null),
  ('TE-COL', 'Índice de colaboración',             'Promedio',   null),
  -- Aprendizaje Autónomo
  ('AA-CON', 'Persistencia en el período',         'Proporcion', null),
  ('AA-REC', 'Uso de recursos de aprendizaje',     'Suma',       null),
  ('AA-PLA', 'Cumplimiento de plazos',             'Proporcion', null),
  ('AA-REG', 'Ajuste tras la retroalimentación',   'Promedio',   null)
) as v(dim, nombre, agregacion, umbral) on v.dim = d.codigo
on conflict (codigo) do nothing;

-- ---------- Verificación ----------

do $$
declare
  v_comp int;
  v_dim  int;
  v_ind  int;
  v_huerfanas int;
begin
  select count(*) into v_comp from atlas.competencias where transversal;
  select count(*) into v_dim  from atlas.dimensiones;
  select count(*) into v_ind  from atlas.indicadores;

  if v_comp < 5 then
    raise exception 'Se esperaban al menos 5 competencias transversales, hay %.', v_comp;
  end if;

  -- Una dimensión sin indicador no se puede medir: el modelo quedaría
  -- incompleto sin que nada avisara.
  select count(*) into v_huerfanas
  from atlas.dimensiones d
  where not exists (select 1 from atlas.indicadores i where i.dimension_id = d.id);

  if v_huerfanas > 0 then
    raise exception 'Hay % dimensiones sin ningun indicador.', v_huerfanas;
  end if;

  raise notice 'Semilla: % competencias, % dimensiones, % indicadores.',
    v_comp, v_dim, v_ind;
end $$;
