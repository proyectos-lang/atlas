-- ============================================================
-- ATLAS · 15 · Correcciones de la analítica
-- ============================================================
--
-- Dos fallos detectados con un escenario de resultado conocido
-- (`npm run analitica`), no por las pruebas unitarias.

-- La versión de `analitica_predictiva()` de la migración 14 emitía la
-- señal «N dimensiones sin evidencia registrada» siempre que N > 0. Al
-- principio de un curso casi ninguna dimensión tiene evidencia, así que
-- la señal aparecía en TODOS los estudiantes --incluidos los de riesgo
-- Bajo-- y ahogaba las que sí distinguen:
--
--   E001 | Alto  | 2 dimensiones bajo 60 · Promedio bajo · ... · 23 sin evidencia
--   E006 | Bajo  | 23 dimensiones sin evidencia registrada
--
-- Una señal que se dispara siempre no señala nada, y compite por la
-- atención con las que sí importan.
--
-- Dos cambios:
--
--   1. La cobertura deja de ser una señal de riesgo DEL ESTUDIANTE. No
--      dice nada sobre él: dice que todavía no se le ha medido. Pasa a
--      emitirse sólo cuando es tan baja que el propio diagnóstico no es
--      fiable, y entonces se dice eso, que es lo accionable.
--
--   2. Se añade `cobertura`, la proporción de dimensiones con evidencia.
--      El docente necesita saber sobre cuánta base se afirma el riesgo:
--      un «Alto» con dos dimensiones medidas de veinticinco no es lo
--      mismo que uno con veinte.
--
-- ES IDEMPOTENTE.

drop function if exists atlas.analitica_predictiva(int[]);

create or replace function atlas.analitica_predictiva(
  p_semanas int[] default null
) returns table (
  usuario_id          bigint,
  curso_id            bigint,
  dimensiones_bajas   bigint,
  dimensiones_totales bigint,
  media_general       numeric,
  minimo              numeric,
  sin_evidencia       bigint,
  cobertura           numeric,
  riesgo              text,
  senales             text[]
)
language sql stable as $$
  with base as (
    select * from atlas.analitica_descriptiva(p_semanas)
  ),
  -- Dimensiones activas que este estudiante debería tener medidas.
  esperadas as (
    select u.id as usuario_id, count(distinct d.id) as total
    from atlas.usuarios u
    cross join atlas.dimensiones d
    join atlas.indicadores i on i.dimension_id = d.id and i.activo
    where u.rol = 'Estudiante' and d.activo
      and (i.curso_id is null or i.curso_id = u.curso_id)
    group by u.id
  ),
  resumen as (
    select
      b.usuario_id,
      b.curso_id,
      count(*) filter (where b.valor < 60)  as bajas,
      count(*)                              as medidas,
      avg(b.valor)                          as media,
      min(b.valor)                          as minimo,
      coalesce(max(e.total), 0)             as esperadas
    from base b
    left join esperadas e on e.usuario_id = b.usuario_id
    group by b.usuario_id, b.curso_id
  ),
  con_cobertura as (
    select
      r.*,
      greatest(r.esperadas - r.medidas, 0) as sin_evidencia,
      case when r.esperadas = 0 then null
           else r.medidas::numeric / r.esperadas
      end                                  as cobertura
    from resumen r
  )
  select
    c.usuario_id,
    c.curso_id,
    c.bajas,
    c.medidas,
    c.media,
    c.minimo,
    c.sin_evidencia,
    c.cobertura,
    case
      when c.media < 50 or c.bajas >= 3 then 'Alto'
      when c.media < 65 or c.bajas >= 1 then 'Medio'
      else 'Bajo'
    end,
    array_remove(array[
      case when c.bajas >= 1
           then c.bajas || ' dimension(es) por debajo de 60' end,
      case when c.media < 50 then 'Promedio general bajo' end,
      case when c.minimo < 40 then 'Alguna dimension muy deficitaria' end,
      -- Sólo cuando la base es tan escasa que el diagnóstico no se
      -- sostiene. Es un aviso sobre la MEDICIÓN, no sobre el estudiante.
      case when c.cobertura is not null and c.cobertura < 0.3
           then 'Diagnostico poco fiable: solo ' || c.medidas ||
                ' de ' || c.esperadas || ' dimensiones con evidencia' end
    ], null)
  from con_cobertura c;
$$;


-- ============================================================
-- FALLO 2 · La clasificación individual/grupo usaba una media
--           contaminada por los propios casos bajos
-- ============================================================

-- La regla de la migración 14 marcaba «Dificultad individual» cuando el
-- valor estaba 10 puntos bajo la media del grupo. Pero si casi todo el
-- grupo falla, esa media baja con ellos, y los peores del grupo acaban
-- clasificados como problema individual.
--
-- Con valores 30, 35, 40, 45, 50 y 85 --cinco de seis suspendiendo-- la
-- media es 47,5 y los tres primeros caían en «individual», cuando el
-- patrón evidente es que falla la enseñanza.
--
-- La corrección mira QUÉ PROPORCIÓN DEL GRUPO falla, que es lo que
-- distingue de verdad un problema colectivo de uno personal:
--
--   más del 40 % del grupo bajo 60  → dificultad DEL GRUPO, para todos
--   sólo unos pocos bajo 60         → dificultad INDIVIDUAL de esos
--
-- El 40 % es el mismo umbral que usa el recomendador para decidir si una
-- recomendación es grupal: conviene que ambos coincidan, porque si no la
-- analítica diría «del grupo» y el agente generaría una individual.

create or replace function atlas.analitica_diagnostica(
  p_semanas int[] default null
) returns table (
  usuario_id      bigint,
  curso_id        bigint,
  competencia     text,
  dimension_id    bigint,
  dimension       text,
  valor           numeric,
  media_grupo     numeric,
  brecha_meta     numeric,
  brecha_grupo    numeric,
  evidencias      bigint,
  tipo            text
)
language sql stable as $$
  with base as (
    select * from atlas.analitica_descriptiva(p_semanas)
  ),
  con_grupo as (
    select
      b.*,
      avg(b.valor)  over (partition by b.curso_id, b.dimension_id) as media_grupo,
      count(*)      over (partition by b.curso_id, b.dimension_id) as total_grupo,
      count(*) filter (where b.valor < 60)
                    over (partition by b.curso_id, b.dimension_id) as bajos_grupo
    from base b
  )
  select
    g.usuario_id,
    g.curso_id,
    g.competencia,
    g.dimension_id,
    g.dimension,
    g.valor,
    g.media_grupo,
    75 - g.valor            as brecha_meta,
    g.valor - g.media_grupo as brecha_grupo,
    g.evidencias,
    case
      -- Falla buena parte del grupo: el problema es de la enseñanza,
      -- aunque este estudiante esté entre los peores.
      when g.valor < 60 and g.bajos_grupo::numeric / g.total_grupo > 0.4
        then 'Dificultad del grupo'
      -- Falla él, no el grupo.
      when g.valor < 60 then 'Dificultad individual'
      when g.valor < 75 then 'En desarrollo'
      when g.valor >= 90 then 'Fortaleza destacada'
      else 'Logrado'
    end                     as tipo
  from con_grupo g;
$$;

-- ---------- Verificación ----------

do $$
declare v_cols int;
begin
  select count(*) into v_cols
  from information_schema.routines r
  join information_schema.parameters p
    on p.specific_name = r.specific_name
  where r.routine_schema = 'atlas'
    and r.routine_name = 'analitica_predictiva'
    and p.parameter_name = 'cobertura';

  if v_cols = 0 then
    raise exception 'analitica_predictiva no expone la columna cobertura.';
  end if;

  raise notice 'Analitica corregida: cobertura separada de las senales, y la '
    'clasificacion individual/grupo mira la proporcion del grupo que falla.';
end $$;
