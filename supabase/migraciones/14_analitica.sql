-- ============================================================
-- ATLAS · 14 · Analítica descriptiva, diagnóstica y predictiva
-- ============================================================

-- Las cuatro funciones del modelo:
--
--   Descriptiva   ¿qué está ocurriendo?
--   Diagnóstica   ¿qué dificultades presenta el estudiante o el grupo?
--   Predictiva    ¿qué patrones anticipan bajo logro?
--   Prescriptiva  ¿qué acción didáctica conviene?
--
-- Las tres primeras viven aquí. La prescriptiva es el recomendador de IA,
-- que ya existe y se alimentará de estas funciones.
--
-- Todo se calcula SOBRE INDICADORES, no sobre calificaciones: es lo que
-- permite decir "falla en depuración", y no sólo "tiene 60".
--
-- ES IDEMPOTENTE.

-- ---------- Descriptiva: qué está ocurriendo ----------

-- Estado actual por dimensión: dónde está cada estudiante y con cuánta
-- evidencia se afirma. El número de evidencias importa tanto como el
-- valor: una dimensión medida con un solo dato no sostiene una decisión.
create or replace function atlas.analitica_descriptiva(
  p_semanas int[] default null
) returns table (
  usuario_id      bigint,
  curso_id        bigint,
  competencia_id  bigint,
  competencia     text,
  dimension_id    bigint,
  dimension       text,
  valor           numeric,
  indicadores     bigint,
  evidencias      bigint
)
language sql stable as $$
  select
    k.usuario_id,
    k.curso_id,
    k.competencia_id,
    c.nombre,
    k.dimension_id,
    d.nombre,
    avg(k.valor),
    count(distinct k.indicador_id),
    sum(k.evidencias)
  from atlas.kpi_evidencias(p_semanas) k
  join atlas.dimensiones d  on d.id = k.dimension_id
  join atlas.competencias c on c.id = k.competencia_id
  where k.valor is not null
  group by k.usuario_id, k.curso_id, k.competencia_id, c.nombre,
           k.dimension_id, d.nombre;
$$;

-- ---------- Diagnóstica: qué dificultades hay ----------

-- Fortalezas y debilidades de cada estudiante, comparando cada dimensión
-- consigo mismo y con su grupo.
--
-- Las dos comparaciones dicen cosas distintas y por eso van ambas:
--   · `brecha_meta`  cuánto le falta para el nivel Alto (75)
--   · `brecha_grupo` si está por debajo de sus compañeros
--
-- Una dimensión baja en TODO el grupo es un problema de enseñanza, no del
-- estudiante; una baja sólo en él es una dificultad individual. Distinguir
-- ambas es justamente lo que permite decidir si la intervención es para
-- la clase o para una persona.
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
      avg(b.valor) over (partition by b.curso_id, b.dimension_id) as media_grupo
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
    75 - g.valor                as brecha_meta,
    g.valor - g.media_grupo     as brecha_grupo,
    g.evidencias,
    case
      -- Bajo y además por debajo del grupo: dificultad propia.
      when g.valor < 60 and g.valor < g.media_grupo - 10 then 'Dificultad individual'
      -- Bajo, pero el grupo también: el problema es de la enseñanza.
      when g.valor < 60 then 'Dificultad del grupo'
      when g.valor < 75 then 'En desarrollo'
      when g.valor >= 90 then 'Fortaleza destacada'
      else 'Logrado'
    end                         as tipo
  from con_grupo g;
$$;

-- ---------- Predictiva: quién está en riesgo ----------

-- No predice notas: identifica PATRONES asociados con bajo logro, que es
-- lo que el modelo pide. Cada señal es observable y explicable, para que
-- el docente pueda contrastarla con lo que ve en clase.
--
-- Deliberadamente NO se usa un modelo estadístico opaco: una alerta que
-- no se puede explicar no sirve para decidir una intervención, y un
-- falso positivo sin justificación destruye la confianza en el sistema.
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
      coalesce(max(e.total), 0) - count(*)  as sin_evidencia
    from base b
    left join esperadas e on e.usuario_id = b.usuario_id
    group by b.usuario_id, b.curso_id
  )
  select
    r.usuario_id,
    r.curso_id,
    r.bajas,
    r.medidas,
    r.media,
    r.minimo,
    greatest(r.sin_evidencia, 0),
    case
      when r.media < 50 or r.bajas >= 3 then 'Alto'
      when r.media < 65 or r.bajas >= 1 then 'Medio'
      else 'Bajo'
    end,
    -- Cada señal explica POR QUÉ, para que la alerta sea accionable.
    array_remove(array[
      case when r.bajas >= 1
           then r.bajas || ' dimension(es) por debajo de 60' end,
      case when r.media < 50 then 'Promedio general bajo' end,
      case when r.minimo < 40 then 'Alguna dimension muy deficitaria' end,
      case when greatest(r.sin_evidencia, 0) > 0
           then greatest(r.sin_evidencia, 0) || ' dimension(es) sin evidencia registrada' end
    ], null)
  from resumen r;
$$;

-- ---------- Verificación ----------

do $$
declare v_fn int;
begin
  select count(*) into v_fn
  from information_schema.routines
  where routine_schema = 'atlas'
    and routine_name in (
      'analitica_descriptiva', 'analitica_diagnostica', 'analitica_predictiva'
    );

  if v_fn <> 3 then
    raise exception 'Se esperaban 3 funciones de analitica, hay %.', v_fn;
  end if;

  raise notice 'Analitica creada: descriptiva, diagnostica y predictiva.';
end $$;
