-- ============================================================
-- ATLAS · 08 · Jerarquía académica
--   Universidad → Programa → Curso → Grupo → (docente, estudiantes)
-- ============================================================

-- Hasta aquí `universidades` mezclaba institución y programa en una fila:
-- "Universidad A / Ingeniería de Sistemas" era UNA fila, y el filtro de
-- programa de la barra lateral trabajaba con el texto de esa columna.
-- Eso impedía que una universidad tuviera varios programas.
--
-- Esta migración separa los niveles SIN MOVER NINGÚN DATO DE HECHOS. Las
-- tablas de foros, colaboración, logs, evaluaciones, rúbrica y resultados
-- no se tocan: siguen colgando de usuario y curso exactamente igual. Por
-- eso los valores de referencia (CTG 73,4 %, embudo 36·36·36·24·11) deben
-- seguir cuadrando después de aplicarla; si no cuadran, algo salió mal.
--
-- ES IDEMPOTENTE: se puede ejecutar dos veces sin duplicar nada.

-- ---------- 1. Programas ----------

create table if not exists atlas.programas (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,          -- P01, P02...
  nombre          text not null,
  universidad_id  bigint not null references atlas.universidades(id),
  modalidad       text,                          -- Virtual, Híbrida, Presencial
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  unique (universidad_id, nombre)
);

create index if not exists ix_programas_universidad
  on atlas.programas(universidad_id);

-- Traslada cada par (universidad, programa) existente a su propia fila.
-- El código se deriva del de la universidad para que P01 corresponda a U01
-- y la correspondencia sea legible al depurar.
insert into atlas.programas (codigo, nombre, universidad_id, modalidad)
select
  'P' || substring(u.codigo from 2),
  u.programa,
  u.id,
  u.modalidad
from atlas.universidades u
where u.programa is not null
on conflict (codigo) do nothing;

-- ---------- 2. Cursos cuelgan del programa ----------

alter table atlas.cursos
  add column if not exists programa_id bigint references atlas.programas(id);

-- Cada curso hereda el programa de su universidad. Con una universidad por
-- programa la correspondencia es única; cuando una universidad tenga varios
-- programas, los cursos nuevos se asignan explícitamente desde la interfaz.
update atlas.cursos c
set programa_id = p.id
from atlas.programas p
where p.universidad_id = c.universidad_id
  and c.programa_id is null;

create index if not exists ix_cursos_programa on atlas.cursos(programa_id);

-- `universidades.programa` se conserva por ahora: quitarla rompería las
-- consultas que todavía la leen. Queda marcada como obsoleta y se elimina
-- en una migración posterior, una vez que nada la use.
comment on column atlas.universidades.programa is
  'OBSOLETA: usar atlas.programas. Se conserva para no romper consultas '
  'existentes; eliminar cuando ninguna la lea.';

-- ---------- 3. Grupos (secciones de un curso) ----------

-- Un curso se dicta en uno o más grupos. Cada grupo tiene su docente y sus
-- estudiantes: es el nivel donde un docente concreto se hace responsable.
create table if not exists atlas.grupos (
  id            bigint generated always as identity primary key,
  codigo        text not null unique,            -- C01-G1
  nombre        text not null,                   -- "Grupo 1"
  curso_id      bigint not null references atlas.cursos(id),

  -- El docente es un PERFIL, no una fila de `usuarios`: en este modelo los
  -- docentes existen como cuentas de acceso, no como registros de datos
  -- (atlas.usuarios contiene sólo estudiantes).
  docente_id    bigint references atlas.perfiles(id),

  periodo       text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  unique (curso_id, nombre)
);

create index if not exists ix_grupos_curso   on atlas.grupos(curso_id);
create index if not exists ix_grupos_docente on atlas.grupos(docente_id);

-- Un grupo por curso para los datos actuales: los 36 estudiantes están
-- repartidos 12 por curso y no hay secciones en el origen. Crear el grupo
-- por defecto permite que el nivel exista sin inventar divisiones.
insert into atlas.grupos (codigo, nombre, curso_id, periodo)
select c.codigo || '-G1', 'Grupo 1', c.id, c.periodo
from atlas.cursos c
on conflict (codigo) do nothing;

-- ---------- 4. Estudiantes pertenecen a un grupo ----------

alter table atlas.usuarios
  add column if not exists grupo_id bigint references atlas.grupos(id);

-- Cada estudiante al grupo por defecto de su curso. Los docentes que
-- pudiera haber en `usuarios` se quedan sin grupo a propósito: su relación
-- con el grupo es `grupos.docente_id`, no esta columna.
update atlas.usuarios u
set grupo_id = g.id
from atlas.grupos g
where g.curso_id = u.curso_id
  and u.grupo_id is null
  and u.rol = 'Estudiante';

create index if not exists ix_usuarios_grupo on atlas.usuarios(grupo_id);

-- ---------- 5. Alcance de los perfiles ----------

-- Dos dimensiones nuevas para el Alcance. NULL significa "sin restricción
-- en esta dimensión", igual que las que ya existían.
alter table atlas.perfiles
  add column if not exists programa_id bigint references atlas.programas(id),
  add column if not exists grupo_id    bigint references atlas.grupos(id);

create index if not exists ix_perfiles_programa on atlas.perfiles(programa_id);
create index if not exists ix_perfiles_grupo    on atlas.perfiles(grupo_id);

-- Los perfiles con universidad asignada heredan su programa, para que el
-- alcance siga resolviendo igual que antes de esta migración.
update atlas.perfiles pf
set programa_id = p.id
from atlas.programas p
where p.universidad_id = pf.universidad_id
  and pf.programa_id is null
  and pf.universidad_id is not null;

-- ---------- 6. El perfil de egreso pertenece al programa ----------

-- La migración 06 lo ató a `universidades` porque entonces esa tabla ERA
-- el programa. Ahora que el programa existe de verdad, se traslada.
alter table atlas.perfiles_egreso
  add column if not exists programa_id bigint references atlas.programas(id);

update atlas.perfiles_egreso pe
set programa_id = p.id
from atlas.programas p
where p.universidad_id = pe.universidad_id
  and pe.programa_id is null;

-- Unique sobre programa: un perfil de egreso por programa.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_perfiles_egreso_programa'
  ) then
    alter table atlas.perfiles_egreso
      add constraint uq_perfiles_egreso_programa unique (programa_id);
  end if;
end $$;

-- ---------- 7. Verificación: nada se quedó sin migrar ----------

do $$
declare
  v_programas         int;
  v_cursos_sin_prog   int;
  v_est_sin_grupo     int;
begin
  select count(*) into v_programas from atlas.programas;
  if v_programas = 0 then
    raise exception 'No se creo ningun programa. Revisar universidades.programa.';
  end if;

  select count(*) into v_cursos_sin_prog
  from atlas.cursos where programa_id is null;
  if v_cursos_sin_prog > 0 then
    raise exception 'Hay % cursos sin programa asignado.', v_cursos_sin_prog;
  end if;

  select count(*) into v_est_sin_grupo
  from atlas.usuarios where rol = 'Estudiante' and grupo_id is null;
  if v_est_sin_grupo > 0 then
    raise exception 'Hay % estudiantes sin grupo asignado.', v_est_sin_grupo;
  end if;

  raise notice 'Jerarquia aplicada: % programas, todos los cursos y estudiantes asignados.',
    v_programas;
end $$;
