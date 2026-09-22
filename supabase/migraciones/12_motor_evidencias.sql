-- ============================================================
-- ATLAS · 12 · Motor de cálculo sobre evidencias
-- ============================================================

-- El motor configurable. A diferencia de `kpi_estudiante()`, donde cada
-- sub-indicador es una fórmula literal, aquí el cálculo se decide leyendo
-- la definición del indicador:
--
--   Promedio    avg(valor)
--   Suma        100 * sum(valor) / valor_esperado
--   Proporcion  100 * count(valor >= umbral) / count(*)
--   Conteo      count(*)
--   Rubrica     100 * sum(valor) / sum(valor_maximo)
--
-- LAS CUATRO REGLAS DEL MOTOR ANTERIOR SE CONSERVAN, porque no son
-- detalles de implementación sino decisiones metodológicas:
--
--   1. Se calcula POR ESTUDIANTE y luego se promedia.
--   2. El truncamiento se aplica ANTES de promediar.
--   3. Los valores esperados se prorratean por semanas del ámbito.
--   4. Escala 0-100, salvo los indicadores declarados en puntos.
--
-- La diferencia es que ahora cada indicador decide si se trunca y si se
-- prorratea, en vez de estar cableado.
--
-- CONVIVE con el motor anterior: no lo reemplaza ni lo toca. Mientras haya
-- indicadores sin evidencias, `kpi_estudiante()` sigue siendo la fuente de
-- las cifras que ya están verificadas.

-- ---------- Un indicador, un estudiante ----------

create or replace function atlas.calcular_indicador(
  p_indicador_id bigint,
  p_usuario_id   bigint,
  p_semanas      int[] default null
) returns numeric
language plpgsql stable as $$
declare
  v_ind       record;
  v_factor    numeric := 1;
  v_semanas_curso int;
  v_valor     numeric;
begin
  select i.*, c.semanas as semanas_curso
  into v_ind
  from atlas.indicadores i
  left join atlas.cursos c on c.id = i.curso_id
  where i.id = p_indicador_id and i.activo;

  if not found then
    return null;
  end if;

  -- Regla 3: prorrateo. El factor reduce el valor esperado en la misma
  -- proporción que las semanas del ámbito. Sin esto, filtrar una semana
  -- compararía la actividad de esa semana contra lo esperado del curso.
  if v_ind.prorratea and p_semanas is not null then
    select coalesce(v_ind.semanas_curso, max(c.semanas), 6)
    into v_semanas_curso
    from atlas.cursos c;

    if v_semanas_curso > 0 then
      v_factor := array_length(p_semanas, 1)::numeric / v_semanas_curso;
    end if;
  end if;

  -- El cálculo, según lo que declare el indicador.
  select
    case v_ind.agregacion
      when 'Promedio' then
        avg(e.valor)

      when 'Suma' then
        case when coalesce(v_ind.valor_esperado, 0) * v_factor = 0 then null
             else 100 * sum(e.valor) / (v_ind.valor_esperado * v_factor)
        end

      when 'Proporcion' then
        case when count(*) = 0 then null
             else 100 * count(*) filter (
                    where e.valor >= coalesce(v_ind.umbral, 0)
                  )::numeric / count(*)
        end

      when 'Conteo' then
        case when coalesce(v_ind.valor_esperado, 0) * v_factor = 0 then count(*)::numeric
             else 100 * count(*) / (v_ind.valor_esperado * v_factor)
        end

      when 'Rubrica' then
        case when coalesce(sum(e.valor_maximo), 0) = 0 then null
             else 100 * sum(e.valor) / sum(e.valor_maximo)
        end
    end
  into v_valor
  from atlas.evidencias e
  where e.indicador_id = p_indicador_id
    and e.usuario_id = p_usuario_id
    and (p_semanas is null or e.semana is null or e.semana = any(p_semanas));

  if v_valor is null then
    return null;
  end if;

  -- Regla 2: el truncamiento se aplica al valor del estudiante, antes de
  -- que nadie promedie. Regla 4: los indicadores en puntos no se truncan
  -- ni se acotan por abajo, porque un negativo puede ser significativo.
  if v_ind.trunca_100 and v_ind.escala = 'Porcentaje' then
    v_valor := least(v_valor, 100);
  end if;

  return v_valor;
end $$;

-- ---------- Todos los indicadores, todos los estudiantes ----------

-- Regla 1: una fila por estudiante e indicador. Quien consuma esta
-- función promedia después; nunca se agrega aquí.
create or replace function atlas.kpi_evidencias(
  p_semanas int[] default null
) returns table (
  usuario_id     bigint,
  curso_id       bigint,
  indicador_id   bigint,
  codigo         text,
  dimension_id   bigint,
  competencia_id bigint,
  valor          numeric,
  evidencias     bigint
)
language sql stable as $$
  select
    u.id,
    u.curso_id,
    i.id,
    i.codigo,
    i.dimension_id,
    d.competencia_id,
    atlas.calcular_indicador(i.id, u.id, p_semanas),
    count(e.id)
  from atlas.usuarios u
  cross join atlas.indicadores i
  join atlas.dimensiones d on d.id = i.dimension_id
  left join atlas.evidencias e
    on e.indicador_id = i.id
   and e.usuario_id = u.id
   and (p_semanas is null or e.semana is null or e.semana = any(p_semanas))
  where u.rol = 'Estudiante'
    and i.activo
    and d.activo
    -- Un indicador de curso sólo aplica a los estudiantes de ese curso.
    and (i.curso_id is null or i.curso_id = u.curso_id)
  group by u.id, u.curso_id, i.id, i.codigo, i.dimension_id, d.competencia_id
  -- Sin evidencias no hay medida. Devolver 0 afirmaría que el estudiante
  -- fue evaluado y obtuvo cero, que es distinto de no haber sido medido.
  having count(e.id) > 0;
$$;

-- ---------- Competencia por estudiante ----------

-- Una competencia es el promedio de sus dimensiones, y cada dimensión el
-- promedio de sus indicadores. Se hace en dos pasos, no en uno: promediar
-- todos los indicadores de golpe daría más peso a las dimensiones con más
-- indicadores, que no es lo que el modelo quiere decir.
create or replace function atlas.kpi_competencia(
  p_semanas int[] default null
) returns table (
  usuario_id     bigint,
  curso_id       bigint,
  competencia_id bigint,
  codigo         text,
  valor          numeric,
  dimensiones    bigint
)
language sql stable as $$
  with por_dimension as (
    select
      k.usuario_id,
      k.curso_id,
      k.competencia_id,
      k.dimension_id,
      avg(k.valor) as valor
    from atlas.kpi_evidencias(p_semanas) k
    where k.valor is not null
    group by k.usuario_id, k.curso_id, k.competencia_id, k.dimension_id
  )
  select
    pd.usuario_id,
    pd.curso_id,
    pd.competencia_id,
    c.codigo,
    avg(pd.valor),
    count(distinct pd.dimension_id)
  from por_dimension pd
  join atlas.competencias c on c.id = pd.competencia_id
  group by pd.usuario_id, pd.curso_id, pd.competencia_id, c.codigo;
$$;

-- ---------- Verificación ----------

do $$
declare v_fn int;
begin
  select count(*) into v_fn
  from information_schema.routines
  where routine_schema = 'atlas'
    and routine_name in ('calcular_indicador', 'kpi_evidencias', 'kpi_competencia');

  if v_fn <> 3 then
    raise exception 'Se esperaban 3 funciones del motor de evidencias, hay %.', v_fn;
  end if;

  raise notice 'Motor de evidencias creado. Convive con kpi_estudiante(), no lo reemplaza.';
end $$;
