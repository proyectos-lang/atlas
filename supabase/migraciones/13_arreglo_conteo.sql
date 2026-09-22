-- ============================================================
-- ATLAS · 13 · Corrección: Conteo sin valor esperado
-- ============================================================

-- La versión de `calcular_indicador()` de la migración 12 devolvía el
-- número crudo de evidencias cuando un indicador de tipo Conteo no tenía
-- `valor_esperado`:
--
--   when 'Conteo' then
--     case when coalesce(v_ind.valor_esperado, 0) * v_factor = 0
--          then count(*)::numeric      <-- el problema
--          else 100 * count(*) / (...)
--
-- Eso mete un número sin escala --3 evidencias, 7 evidencias-- en el
-- mismo promedio que indicadores en 0-100, y el valor de la competencia
-- deja de significar nada. Se detectó probando el flujo completo: tres
-- estudiantes con 5, 3 y 1 errores corregidos daban todos 1,0.
--
-- Un Conteo sin referencia contra la que comparar no es medible. Devolver
-- null es lo correcto: el indicador simplemente no aporta hasta que
-- alguien le configure cuántas evidencias se esperan.
--
-- ES IDEMPOTENTE.

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
  -- proporción que las semanas del ámbito.
  if v_ind.prorratea and p_semanas is not null then
    select coalesce(v_ind.semanas_curso, max(c.semanas), 6)
    into v_semanas_curso
    from atlas.cursos c;

    if v_semanas_curso > 0 then
      v_factor := array_length(p_semanas, 1)::numeric / v_semanas_curso;
    end if;
  end if;

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

      -- Sin valor esperado no hay contra qué comparar el conteo, y
      -- devolver el número crudo lo mezclaría con los porcentajes.
      when 'Conteo' then
        case when coalesce(v_ind.valor_esperado, 0) * v_factor = 0 then null
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

  -- Regla 2: truncamiento por estudiante, antes de promediar.
  -- Regla 4: los indicadores en puntos no se truncan.
  if v_ind.trunca_100 and v_ind.escala = 'Porcentaje' then
    v_valor := least(v_valor, 100);
  end if;

  return v_valor;
end $$;

-- Los indicadores de Conteo sembrados en la migración 10 no traían valor
-- esperado, así que no podían medir nada. Se les da uno razonable, que el
-- docente ajusta después desde la aplicación.
update atlas.indicadores
set valor_esperado = 5
where agregacion = 'Conteo'
  and valor_esperado is null;

-- A partir de aquí, un Conteo sin valor esperado no se puede guardar: el
-- indicador quedaría configurado pero mudo.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ck_indicadores_conteo_esperado'
  ) then
    alter table atlas.indicadores
      add constraint ck_indicadores_conteo_esperado
      check (agregacion <> 'Conteo' or valor_esperado is not null);
  end if;
end $$;

-- ---------- Verificación ----------

do $$
declare v_mudos int;
begin
  select count(*) into v_mudos
  from atlas.indicadores
  where agregacion = 'Conteo' and valor_esperado is null;

  if v_mudos > 0 then
    raise exception 'Quedan % indicadores de Conteo sin valor esperado.', v_mudos;
  end if;

  raise notice 'Conteo corregido: sin valor esperado devuelve null, no un numero sin escala.';
end $$;
