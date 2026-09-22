-- ============================================================
-- ATLAS · 16 · Recomendación sobre indicadores e intervenciones
-- ============================================================

-- Puntos 11 y 12 del modelo. Cierra el ciclo:
--
--   Datos → Analítica → Recomendación → Intervención
--     → Nueva evidencia → Nueva analítica
--
-- Hasta aquí, `recomendaciones_ia` guardaba la competencia como TEXTO y
-- el sub-indicador crítico como una cadena suelta. Servía para el modelo
-- anterior, pero no permite responder «esta recomendación atacaba la
-- dimensión Depuración y el indicador X, y estos fueron sus efectos».
--
-- Se añaden las claves al modelo nuevo SIN romper lo existente: las
-- columnas de texto se conservan, y las nuevas son opcionales. Las 99
-- recomendaciones ya generadas siguen leyéndose igual.
--
-- ES IDEMPOTENTE.

-- ---------- 1. La recomendación apunta al modelo nuevo ----------

alter table atlas.recomendaciones_ia
  add column if not exists competencia_id bigint references atlas.competencias(id),
  add column if not exists dimension_id   bigint references atlas.dimensiones(id),
  add column if not exists indicador_id   bigint references atlas.indicadores(id),
  add column if not exists resultado_id   bigint references atlas.resultados(id),
  -- Qué patrón de la analítica la originó: 'Dificultad individual',
  -- 'Dificultad del grupo'… Es lo que permite evaluar después si la
  -- recomendación acertó con el tipo de problema.
  add column if not exists patron         text,
  -- Nivel de logro en el momento de recomendarla. `valor_antes` ya
  -- existía pero se llenaba con el índice del modelo viejo.
  add column if not exists valor_indicador_antes numeric;

create index if not exists ix_reco_competencia on atlas.recomendaciones_ia(competencia_id);
create index if not exists ix_reco_dimension   on atlas.recomendaciones_ia(dimension_id);
create index if not exists ix_reco_indicador   on atlas.recomendaciones_ia(indicador_id);

-- Enlaza las recomendaciones existentes con la competencia del modelo
-- nuevo, por nombre. Sólo rellena lo que esté vacío.
update atlas.recomendaciones_ia r
set competencia_id = c.id
from atlas.competencias c
where c.nombre = r.competencia
  and r.competencia_id is null;

-- ---------- 2. Intervenciones ----------

-- Qué hizo el docente con la recomendación. Una recomendación puede
-- producir varias intervenciones --se intenta, se ajusta, se reintenta--
-- y por eso es una tabla aparte y no columnas en `recomendaciones_ia`.
create table if not exists atlas.intervenciones (
  id                bigint generated always as identity primary key,
  recomendacion_id  bigint references atlas.recomendaciones_ia(id),

  -- Puede haber intervención sin recomendación previa: el docente decide
  -- algo por su cuenta y quiere registrarlo. El ciclo de mejora no
  -- empieza necesariamente en la IA.
  curso_id          bigint not null references atlas.cursos(id),
  grupo_id          bigint references atlas.grupos(id),
  usuario_id        bigint references atlas.usuarios(id),  -- null = grupal

  dimension_id      bigint references atlas.dimensiones(id),
  indicador_id      bigint references atlas.indicadores(id),

  descripcion       text not null,
  estrategia        text,            -- ABP, estudio de caso, debate…
  actividad_id      bigint references atlas.actividades(id),

  -- El valor del indicador cuando se decidió intervenir. Se captura al
  -- registrar la intervención, no después: si se tomara al cerrarla ya
  -- estaría contaminado por el efecto que se quiere medir.
  valor_antes       numeric,
  valor_despues     numeric,
  medido_en         timestamptz,

  estado            text not null default 'Planificada',
  fecha_inicio      date,
  fecha_cierre      date,
  observaciones     text,

  registrado_por    bigint references atlas.perfiles(id),
  creado_en         timestamptz not null default now(),

  constraint ck_intervenciones_estado check (estado in (
    'Planificada', 'En curso', 'Completada', 'Descartada'
  )),
  constraint ck_intervenciones_descripcion
    check (length(btrim(descripcion)) >= 10)
);

create index if not exists ix_intervenciones_curso    on atlas.intervenciones(curso_id);
create index if not exists ix_intervenciones_usuario  on atlas.intervenciones(usuario_id);
create index if not exists ix_intervenciones_dimension on atlas.intervenciones(dimension_id);
create index if not exists ix_intervenciones_reco     on atlas.intervenciones(recomendacion_id);

-- ---------- 3. Las evidencias saben a qué intervención pertenecen ----------

-- Sin esto no se puede separar la evidencia anterior de la posterior, y
-- medir el efecto sería imposible: se estarían mezclando los datos que
-- motivaron la intervención con los que deberían mostrar su resultado.
alter table atlas.evidencias
  add column if not exists intervencion_id bigint references atlas.intervenciones(id),
  -- 'Antes' | 'Despues' | null cuando no participa de ninguna medición.
  add column if not exists momento text;

create index if not exists ix_evidencias_intervencion
  on atlas.evidencias(intervencion_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ck_evidencias_momento'
  ) then
    alter table atlas.evidencias
      add constraint ck_evidencias_momento
      check (momento is null or momento in ('Antes', 'Despues'));
  end if;
end $$;

-- ---------- 4. Efecto de una intervención ----------

-- Compara el indicador antes y después. No decide si «funcionó»: da el
-- cambio y el número de evidencias de cada lado, para que el docente
-- juzgue. Un cambio de 20 puntos medido con una sola evidencia posterior
-- no dice lo mismo que uno de 5 puntos medido con quince.
create or replace function atlas.efecto_intervencion(
  p_intervencion_id bigint
) returns table (
  intervencion_id   bigint,
  indicador_id      bigint,
  indicador         text,
  dimension         text,
  estudiantes       bigint,
  valor_antes       numeric,
  valor_despues     numeric,
  cambio            numeric,
  evidencias_antes  bigint,
  evidencias_despues bigint
)
language sql stable as $$
  with iv as (
    select * from atlas.intervenciones where id = p_intervencion_id
  ),
  -- Alcance de la intervención: un estudiante, o todo el grupo o curso.
  alcanzados as (
    select u.id as usuario_id
    from atlas.usuarios u, iv
    where u.rol = 'Estudiante'
      and (iv.usuario_id is not null and u.id = iv.usuario_id
           or iv.usuario_id is null and iv.grupo_id is not null and u.grupo_id = iv.grupo_id
           or iv.usuario_id is null and iv.grupo_id is null and u.curso_id = iv.curso_id)
  ),
  medidas as (
    select
      e.indicador_id,
      e.momento,
      avg(e.valor) as valor,
      count(*)     as n
    from atlas.evidencias e
    join alcanzados a on a.usuario_id = e.usuario_id
    join iv on true
    where e.momento is not null
      and (iv.indicador_id is null or e.indicador_id = iv.indicador_id)
      and (e.intervencion_id = p_intervencion_id or e.intervencion_id is null)
    group by e.indicador_id, e.momento
  )
  select
    p_intervencion_id,
    i.id,
    i.nombre,
    d.nombre,
    (select count(*) from alcanzados),
    max(m.valor) filter (where m.momento = 'Antes'),
    max(m.valor) filter (where m.momento = 'Despues'),
    max(m.valor) filter (where m.momento = 'Despues')
      - max(m.valor) filter (where m.momento = 'Antes'),
    coalesce(max(m.n) filter (where m.momento = 'Antes'), 0),
    coalesce(max(m.n) filter (where m.momento = 'Despues'), 0)
  from medidas m
  join atlas.indicadores i on i.id = m.indicador_id
  join atlas.dimensiones d on d.id = i.dimension_id
  group by i.id, i.nombre, d.nombre;
$$;

-- ---------- 5. Verificación ----------

do $$
declare
  v_tabla int;
  v_fn    int;
  v_cols  int;
begin
  select count(*) into v_tabla
  from information_schema.tables
  where table_schema = 'atlas' and table_name = 'intervenciones';

  if v_tabla <> 1 then
    raise exception 'No se creo la tabla intervenciones.';
  end if;

  select count(*) into v_fn
  from information_schema.routines
  where routine_schema = 'atlas' and routine_name = 'efecto_intervencion';

  if v_fn = 0 then
    raise exception 'No se creo la funcion efecto_intervencion.';
  end if;

  -- Sin estas columnas la recomendación no puede apuntar al modelo nuevo
  -- y el ciclo quedaría roto por la mitad.
  select count(*) into v_cols
  from information_schema.columns
  where table_schema = 'atlas' and table_name = 'recomendaciones_ia'
    and column_name in ('competencia_id', 'dimension_id', 'indicador_id');

  if v_cols <> 3 then
    raise exception 'recomendaciones_ia no tiene las 3 claves al modelo nuevo, tiene %.', v_cols;
  end if;

  raise notice 'Intervenciones creadas. El ciclo datos-analitica-recomendacion-intervencion queda cerrado.';
end $$;
