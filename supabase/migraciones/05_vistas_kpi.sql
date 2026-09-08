-- ============================================================
-- ATLAS · 05 · Motor de indicadores
--
-- CUATRO REGLAS NO NEGOCIABLES:
--
-- 1. Los indicadores de razón se calculan POR ESTUDIANTE y luego se
--    promedian. Nunca suma_del_grupo / esperado_del_grupo: da distinto
--    y no representa a las personas.
-- 2. El truncamiento en 100 se aplica POR ESTUDIANTE, ANTES de promediar.
--    Quien superó lo esperado aporta 100, no 140.
-- 3. Los valores esperados se PRORRATEAN según las semanas del ámbito:
--    factor = semanas_en_ambito / semanas_del_curso. Sin esto, filtrar
--    una semana hunde el índice de trabajo en equipo de 66 % a 25 %.
-- 4. Todo en escala 0-100, salvo el índice de brecha, que va en puntos
--    y puede ser negativo.
--
-- CPP es la excepción a la regla 3: NO se prorratea (se divide entre las
-- 5 actividades programadas, no entre 5 x factor).
--
-- Las funciones reciben el ámbito como parámetros; la capa TypeScript
-- sólo filtra y lee.
-- ============================================================

-- Parámetro de un curso, con respaldo si no estuviera definido.
create or replace function atlas.parametro(
  p_curso_id bigint, p_codigo text, p_defecto numeric
) returns numeric
language sql stable as $$
  select coalesce(
    (select valor from atlas.parametros
      where curso_id = p_curso_id and codigo_kpi = p_codigo),
    p_defecto);
$$;

-- ============================================================
-- v_kpi_estudiante: un renglón por estudiante con los 22 sub-indicadores,
-- ya truncados por estudiante. Acepta un ámbito de semanas.
-- ============================================================
create or replace function atlas.kpi_estudiante(
  p_semanas int[] default null   -- null = todas las semanas del curso
) returns table (
  usuario_id      bigint,
  curso_id        bigint,
  universidad_id  bigint,
  -- Trabajo en Equipo
  icol numeric, tpi numeric, rip numeric, ncg numeric, ta numeric,
  -- Aprendizaje Autónomo
  fa numeric, te numeric, upr numeric, cpp numeric, tps numeric,
  -- Comunicación Efectiva
  clt numeric, npa numeric, cid numeric, crf numeric,
  -- Pensamiento Crítico
  na numeric, ns numeric, ea numeric, td numeric,
  -- Resolución de Problemas
  nia numeric, tra numeric, uea numeric, dpa numeric
)
language sql stable as $$
with
-- Semanas del ámbito y factor de prorrateo por curso.
ambito as (
  select c.id as curso_id,
         c.semanas as semanas_curso,
         coalesce(array_length(p_semanas, 1), c.semanas) as semanas_ambito
  from atlas.cursos c
),
factor as (
  select curso_id, semanas_curso,
         semanas_ambito::numeric / nullif(semanas_curso, 0) as f
  from ambito
),
est as (
  select u.id as usuario_id, u.curso_id, u.universidad_id
  from atlas.usuarios u
  where u.rol = 'Estudiante'
),
-- ---------- Agregados por estudiante dentro del ámbito ----------
ag_foros as (
  select f.usuario_id,
         sum(f.intervenciones)        as intervenciones,
         sum(f.respuestas_emitidas)   as resp_emitidas,
         sum(f.respuestas_recibidas)  as resp_recibidas,
         avg(f.calidad_argumentativa) as calidad_media,
         count(*)                     as filas,
         count(*) filter (where f.calidad_argumentativa >= 70) as filas_ok
  from atlas.foros f
  where p_semanas is null or f.semana = any(p_semanas)
  group by f.usuario_id
),
ag_colab as (
  select c.usuario_id,
         sum(c.aportes)          as aportes,
         sum(c.interacciones)    as interacciones,
         avg(c.evaluacion_pares) as eval_pares
  from atlas.colaboracion c
  where p_semanas is null or c.semana = any(p_semanas)
  group by c.usuario_id
),
ag_logs as (
  select l.usuario_id,
         sum(l.accesos)              as accesos,
         sum(l.minutos)              as minutos,
         sum(l.recursos_consultados) as recursos,
         count(distinct l.semana) filter (where l.accesos > 0) as semanas_activas
  from atlas.moodle_logs l
  where p_semanas is null or l.semana = any(p_semanas)
  group by l.usuario_id
),
-- Evaluaciones y resultados no tienen semana en el origen: no se filtran.
ag_eval as (
  select e.usuario_id,
         count(*) filter (where e.entrega_puntual)        as puntuales,
         count(*)                                        as total,
         count(*) filter (where e.calificacion >= 70)     as resueltas,
         sum(e.calificacion)                             as calificacion,
         sum(e.puntaje_maximo)                           as maximo
  from atlas.evaluaciones e
  group by e.usuario_id
),
-- Aportes totales del curso, para el nivel de contribución grupal.
aportes_curso as (
  select c.curso_id, sum(c.aportes) as total
  from atlas.colaboracion c
  where p_semanas is null or c.semana = any(p_semanas)
  group by c.curso_id
),
-- Rúbrica: mismo patrón para los seis criterios.
ag_rubrica as (
  select r.usuario_id, rc.codigo_kpi,
         sum(r.valor_obtenido) as obtenido,
         sum(r.valor_maximo)   as maximo
  from atlas.rubrica r
  join atlas.rubrica_criterios rc on rc.id = r.criterio_id
  where p_semanas is null or r.semana = any(p_semanas)
  group by r.usuario_id, rc.codigo_kpi
),
rub as (
  select usuario_id,
    max(case when codigo_kpi='NA'  then 100*obtenido/nullif(maximo,0) end) as na,
    max(case when codigo_kpi='NS'  then 100*obtenido/nullif(maximo,0) end) as ns,
    max(case when codigo_kpi='EA'  then 100*obtenido/nullif(maximo,0) end) as ea,
    max(case when codigo_kpi='TD'  then 100*obtenido/nullif(maximo,0) end) as td,
    max(case when codigo_kpi='NIA' then 100*obtenido/nullif(maximo,0) end) as nia,
    max(case when codigo_kpi='UEA' then 100*obtenido/nullif(maximo,0) end) as uea
  from ag_rubrica group by usuario_id
)
select
  e.usuario_id, e.curso_id, e.universidad_id,

  -- ---------- Trabajo en Equipo ----------
  -- ICOL: proporción de interacciones colaborativas sobre el total. Sin tope.
  -- Sin actividad alguna (0/0) se cuenta 0, no nulo: en el conjunto completo
  -- no ocurre, pero al filtrar una sola semana hay estudiantes sin actividad
  -- y un nulo contaminaría el promedio del índice.
  coalesce(100 * coalesce(cl.interacciones, 0)::numeric
    / nullif(coalesce(cl.interacciones,0) + coalesce(fo.intervenciones,0), 0), 0)  as icol,
  least(100, 100 * coalesce(fo.intervenciones,0)
    / nullif(atlas.parametro(e.curso_id,'TPI',18) * fa.f, 0))                      as tpi,
  least(100, 100 * (coalesce(fo.resp_emitidas,0) + coalesce(fo.resp_recibidas,0))
    / nullif(atlas.parametro(e.curso_id,'RIP',12) * fa.f, 0))                      as rip,
  least(100, 100 * coalesce(cl.aportes,0)::numeric
    / nullif(ac.total, 0))                                                          as ncg,
  least(100, 100 * coalesce(cl.aportes,0)
    / nullif(atlas.parametro(e.curso_id,'TA',22) * fa.f, 0))                       as ta,

  -- ---------- Aprendizaje Autónomo ----------
  least(100, 100 * coalesce(lg.accesos,0)
    / nullif(atlas.parametro(e.curso_id,'FA',60) * fa.f, 0))                       as fa_,
  least(100, 100 * coalesce(lg.minutos,0)
    / nullif(atlas.parametro(e.curso_id,'TE',1500) * fa.f, 0))                     as te,
  least(100, 100 * coalesce(lg.recursos,0)
    / nullif(atlas.parametro(e.curso_id,'UPR',48) * fa.f, 0))                      as upr,
  -- CPP no se prorratea: se divide entre las actividades programadas.
  least(100, 100 * coalesce(ev.puntuales,0)
    / nullif(atlas.parametro(e.curso_id,'CPP',5), 0))                              as cpp,
  least(100, 100 * coalesce(lg.semanas_activas,0)::numeric
    / nullif(fa.semanas_curso * fa.f, 0))                                          as tps,

  -- ---------- Comunicación Efectiva ----------
  coalesce(fo.calidad_media, 0)                                                     as clt,
  coalesce(100 * coalesce(fo.filas_ok,0)::numeric / nullif(fo.filas, 0), 0)         as npa,
  least(100, 100 * coalesce(fo.resp_emitidas,0)
    / nullif(atlas.parametro(e.curso_id,'CID',15) * fa.f, 0))                      as cid,
  coalesce(cl.eval_pares, 0)                                                        as crf,

  -- ---------- Pensamiento Crítico (rúbrica) ----------
  rb.na, rb.ns, rb.ea, rb.td,

  -- ---------- Resolución de Problemas ----------
  rb.nia,
  coalesce(100 * coalesce(ev.resueltas,0)::numeric / nullif(ev.total, 0), 0)        as tra,
  rb.uea,
  coalesce(100 * coalesce(ev.calificacion,0) / nullif(ev.maximo, 0), 0)             as dpa

from est e
join factor fa            on fa.curso_id = e.curso_id
left join ag_foros fo     on fo.usuario_id = e.usuario_id
left join ag_colab cl     on cl.usuario_id = e.usuario_id
left join ag_logs lg      on lg.usuario_id = e.usuario_id
left join ag_eval ev      on ev.usuario_id = e.usuario_id
left join aportes_curso ac on ac.curso_id = e.curso_id
left join rub rb          on rb.usuario_id = e.usuario_id;
$$;

-- ============================================================
-- kpi_indice: los cinco índices y el global, por estudiante.
-- Cada índice es el promedio simple de sus sub-indicadores.
-- CTG = Σ(índice x peso) / Σ(pesos): dividir entre la suma de pesos
-- mantiene la escala 0-100 aunque los pesos cambien.
-- ============================================================
create or replace function atlas.kpi_indice(
  p_semanas int[] default null
) returns table (
  usuario_id bigint, curso_id bigint, universidad_id bigint,
  ite numeric, iau numeric, icom numeric, ipc numeric, irp numeric, ctg numeric
)
language sql stable as $$
with k as (select * from atlas.kpi_estudiante(p_semanas)),
i as (
  select k.usuario_id, k.curso_id, k.universidad_id,
    (k.icol + k.tpi + k.rip + k.ncg + k.ta) / 5.0        as ite,
    (k.fa + k.te + k.upr + k.cpp + k.tps)   / 5.0        as iau,
    (k.clt + k.npa + k.cid + k.crf)         / 4.0        as icom,
    (k.na + k.ns + k.ea + k.td)             / 4.0        as ipc,
    (k.nia + k.tra + k.uea + k.dpa)         / 4.0        as irp
  from k
)
select i.usuario_id, i.curso_id, i.universidad_id,
  i.ite, i.iau, i.icom, i.ipc, i.irp,
  (i.ite * atlas.parametro(i.curso_id,'ITE',0.20)
 + i.iau * atlas.parametro(i.curso_id,'IAU',0.20)
 + i.icom* atlas.parametro(i.curso_id,'ICOM',0.20)
 + i.ipc * atlas.parametro(i.curso_id,'IPC',0.20)
 + i.irp * atlas.parametro(i.curso_id,'IRP',0.20))
  / nullif(atlas.parametro(i.curso_id,'ITE',0.20)
         + atlas.parametro(i.curso_id,'IAU',0.20)
         + atlas.parametro(i.curso_id,'ICOM',0.20)
         + atlas.parametro(i.curso_id,'IPC',0.20)
         + atlas.parametro(i.curso_id,'IRP',0.20), 0) as ctg
from i;
$$;

-- ============================================================
-- kpi_ilo: indicadores de resultados de aprendizaje, por estudiante.
-- ILRA individual sirve además para la etapa 4 del embudo.
-- ============================================================
create or replace function atlas.kpi_ilo()
returns table (
  usuario_id bigint, curso_id bigint,
  ilra numeric, tlc numeric, iba numeric, nla numeric
)
language sql stable as $$
select r.usuario_id, r.curso_id,
  100 * count(*) filter (where r.logro_porcentaje >= atlas.parametro(r.curso_id,'ILRA',70))::numeric
      / nullif(count(*), 0)                                    as ilra,
  avg(r.logro_porcentaje)                                      as tlc,
  -- En puntos, puede ser negativo: no se lee con la escala de colores.
  atlas.parametro(r.curso_id,'IBA',85) - avg(r.logro_porcentaje) as iba,
  (select 100 * sum(e.calificacion) / nullif(sum(e.puntaje_maximo), 0)
     from atlas.evaluaciones e where e.usuario_id = r.usuario_id) as nla
from atlas.resultados_aprendizaje r
group by r.usuario_id, r.curso_id;
$$;

-- ============================================================
-- kpi_embudo: las cinco etapas de progresión.
-- ============================================================
create or replace function atlas.kpi_embudo(
  p_universidades bigint[] default null,
  p_cursos        bigint[] default null,
  p_usuarios      bigint[] default null
) returns table (etapa int, nombre text, criterio text, conteo bigint)
language sql stable as $$
with est as (
  select u.id, u.curso_id, c.semanas
  from atlas.usuarios u
  join atlas.cursos c on c.id = u.curso_id
  where u.rol = 'Estudiante'
    and (p_universidades is null or u.universidad_id = any(p_universidades))
    and (p_cursos        is null or u.curso_id       = any(p_cursos))
    and (p_usuarios      is null or u.id             = any(p_usuarios))
),
activos as (
  select l.usuario_id
  from atlas.moodle_logs l join est e on e.id = l.usuario_id
  where l.accesos > 0
  group by l.usuario_id, e.semanas
  having count(distinct l.semana) >= ceil(e.semanas / 2.0)
),
sostenida as (
  select f.usuario_id
  from atlas.foros f join est e on e.id = f.usuario_id
  where f.intervenciones > 0
  group by f.usuario_id, e.semanas
  having count(distinct f.semana) >= ceil(e.semanas / 2.0)
),
logran as (
  select k.usuario_id from atlas.kpi_ilo() k
  join est e on e.id = k.usuario_id where k.ilra >= 60
),
desarrollan as (
  select k.usuario_id from atlas.kpi_indice() k
  join est e on e.id = k.usuario_id where k.ctg >= 75
)
select 1, 'Estudiantes matriculados',        'Usuarios con rol Estudiante en el ámbito',                (select count(*) from est)
union all select 2, 'Activos en la plataforma',      'Con accesos en al menos la mitad de las semanas',         (select count(*) from activos)
union all select 3, 'Participan de forma sostenida', 'Con intervenciones en foro en al menos la mitad de las semanas', (select count(*) from sostenida)
union all select 4, 'Logran los resultados de aprendizaje', 'Índice individual de logro de ILOs mayor o igual a 60', (select count(*) from logran)
union all select 5, 'Desarrollan las competencias',  'Competencia transversal global individual mayor o igual a 75', (select count(*) from desarrollan)
order by 1;
$$;
