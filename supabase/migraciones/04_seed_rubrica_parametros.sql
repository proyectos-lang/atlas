-- ============================================================
-- ATLAS · 04 · Semillas deterministas de rúbrica y parámetros
--
-- REQUISITO: ejecutar DESPUES de `npm run seed`. Los dos INSERT hacen
-- cross join contra usuarios y semanas; si están vacías insertan 0 filas
-- en silencio.
--
-- CRÍTICO: el generador NO usa aleatoriedad. Los valores de referencia
-- de las pruebas sólo cuadran si se reproducen exactamente estos números.
--
-- CRÍTICO: round() debe operar sobre `numeric` (media hacia arriba).
-- Con redondeo bancario (float8) 26 de 1296 celdas bajan 1 punto y
-- NA, EA, TD y NIA dejan de cuadrar. No introducir ningún ::float8.
--
-- Este script se auto-verifica: si los anclajes no cuadran, aborta y
-- deshace la transacción en vez de dejar datos silenciosamente mal.
-- ============================================================

begin;

-- ---------- Los seis criterios ----------
insert into atlas.rubrica_criterios (codigo_kpi, criterio, actividad, orden, valor_maximo)
values
  ('NA',  'Argumentos fundamentados',             'Debate académico', 1, 10),
  ('NS',  'Integración y síntesis de ideas',      'Estudio de caso',  2, 100),
  ('EA',  'Alternativas evaluadas correctamente', 'Estudio de caso',  3, 5),
  ('TD',  'Decisiones justificadas con evidencia','Estudio de caso',  4, 5),
  ('NIA', 'Problemas identificados correctamente','Reto aplicado',    5, 6),
  ('UEA', 'Estrategias de análisis aplicadas',    'Reto aplicado',    6, 4)
on conflict (codigo_kpi) do update set
  criterio     = excluded.criterio,
  actividad    = excluded.actividad,
  orden        = excluded.orden,
  valor_maximo = excluded.valor_maximo;

-- ---------- 1296 filas: 36 estudiantes x 6 criterios x 6 semanas ----------
-- Sólo rellena la semilla; nunca pisa una calificación real del docente.
insert into atlas.rubrica
  (usuario_id, curso_id, semana, criterio_id, valor_obtenido, valor_maximo, es_semilla)
select
  u.id,
  u.curso_id,
  s.numero,
  c.id,
  round(
    c.valor_maximo * least(
      greatest(
          0.55 + (mod(g.s1, 26)::numeric / 100)                    -- base por estudiante y criterio
        + ((s.numero - 1) * 0.02)                                  -- progresión: +2 puntos por semana
        + ((mod(g.s1 * 7 + s.numero * 31, 9) - 4)::numeric / 100)  -- variación ±4 puntos
      , 0.35),
      1.00)
  , 0),
  c.valor_maximo,
  true
from atlas.usuarios u
cross join atlas.rubrica_criterios c
cross join atlas.semanas s
cross join lateral (
  select (substring(u.codigo from 2 for 3))::int * 13 + c.orden * 29 as s1
) g
where u.rol = 'Estudiante'
on conflict (usuario_id, criterio_id, semana) do nothing;

-- ---------- Parámetros: 18 filas por curso ----------
insert into atlas.parametros (curso_id, codigo_kpi, parametro, valor, unidad, origen)
select cu.id, p.codigo_kpi, p.parametro, p.valor, p.unidad, 'Supuesto'
from atlas.cursos cu
cross join (values
  ('FA',   'Accesos esperados en el curso',     60,   'accesos'),
  ('TE',   'Minutos de estudio esperados',      1500, 'minutos'),
  ('TPI',  'Intervenciones esperadas en foros', 18,   'intervenciones'),
  ('TA',   'Aportes colaborativos esperados',   22,   'aportes'),
  ('UPR',  'Consultas de recursos esperadas',   48,   'consultas'),
  ('CID',  'Respuestas esperadas en debates',   15,   'respuestas'),
  ('TPS',  'Semanas del curso',                 6,    'semanas'),
  ('CPP',  'Actividades programadas',           5,    'actividades'),
  ('RIP',  'Estudiantes del curso',             12,   'estudiantes'),
  ('NPA',  'Umbral de calidad argumentativa',   70,   'puntos'),
  ('TRA',  'Umbral de actividad resuelta',      70,   'puntos'),
  ('ILRA', 'Umbral de logro del ILO',           70,   'puntos'),
  ('IBA',  'Logro esperado del ILO',            85,   'puntos'),
  ('ITE',  'Peso en el índice global',          0.20, 'peso'),
  ('IAU',  'Peso en el índice global',          0.20, 'peso'),
  ('ICOM', 'Peso en el índice global',          0.20, 'peso'),
  ('IPC',  'Peso en el índice global',          0.20, 'peso'),
  ('IRP',  'Peso en el índice global',          0.20, 'peso')
) as p(codigo_kpi, parametro, valor, unidad)
on conflict (curso_id, codigo_kpi) do nothing;   -- respeta ediciones del docente

-- ---------- Auto-verificación ----------
-- Aborta si el generador no reprodujo exactamente los anclajes.
do $$
declare
  v_filas   int;
  v_params  int;
  v_fallos  text := '';
  r         record;
begin
  select count(*) into v_filas  from atlas.rubrica;
  select count(*) into v_params from atlas.parametros;

  if v_filas <> 1296 then
    raise exception 'Rubrica: % filas, se esperaban 1296. Ejecutar despues de npm run seed.', v_filas;
  end if;
  if v_params <> 54 then
    raise exception 'Parametros: % filas, se esperaban 54.', v_params;
  end if;

  for r in
    select c.codigo_kpi,
           sum(rb.valor_obtenido)::int as obt,
           sum(rb.valor_maximo)::int   as max
    from atlas.rubrica rb
    join atlas.rubrica_criterios c on c.id = rb.criterio_id
    group by c.codigo_kpi
  loop
    if (r.codigo_kpi, r.obt, r.max) not in (
        ('NA', 1512, 2160), ('NS', 15660, 21600), ('EA',  810, 1080),
        ('TD',  850, 1080), ('NIA',  898,  1296), ('UEA', 616,  864))
    then
      v_fallos := v_fallos || format(' %s=%s/%s', r.codigo_kpi, r.obt, r.max);
    end if;
  end loop;

  if v_fallos <> '' then
    raise exception 'Anclajes de rubrica incorrectos:%. Revisar que round() opere sobre numeric y no float8.', v_fallos;
  end if;

  raise notice 'Semilla correcta: 1296 filas de rubrica, 54 parametros, anclajes verificados.';
end $$;

commit;
