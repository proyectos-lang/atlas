-- ============================================================
-- ATLAS · 18 · Edición de entidades y perfil de egreso por programa
-- ============================================================

-- Reportado por el usuario final: no podía crear universidades, el
-- perfil de egreso mostraba nombres de programa que no correspondían, y
-- no había forma de editar ni eliminar nada.
--
-- Tres cosas se arreglan aquí; el resto es interfaz.
--
-- 1. `universidades.programa` y `.modalidad` eran NOT NULL. Desde la
--    migración 08 el programa vive en su propia tabla y esa columna es
--    OBSOLETA, pero seguía exigiendo un valor: crear una universidad sin
--    inventarle un programa de texto era imposible.
--
-- 2. `perfiles_egreso` tenía UNIQUE sobre universidad_id (migración 06,
--    cuando universidad y programa eran la misma fila). Una universidad
--    con dos programas sólo podía tener un perfil de egreso. El perfil
--    pertenece al PROGRAMA: la clave pasa a ser programa_id.
--
-- 3. `universidades` y `cursos` no tenían `activo`. Sin él, la única
--    forma de retirar un curso era borrarlo, y un curso con datos de
--    estudiantes NO se puede borrar (22 tablas dependen de él). Ahora se
--    desactiva, como ya hacían programas y grupos.
--
-- ES IDEMPOTENTE.

-- ---------- 1. La columna obsoleta deja de exigir valor ----------

alter table atlas.universidades
  alter column programa  drop not null,
  alter column modalidad drop not null;

comment on column atlas.universidades.programa is
  'OBSOLETA desde la migración 08: usar atlas.programas. Nullable para '
  'que crear una universidad no obligue a inventar un programa de texto.';

-- ---------- 2. Desactivar en vez de borrar ----------

alter table atlas.universidades
  add column if not exists activo boolean not null default true;

alter table atlas.cursos
  add column if not exists activo boolean not null default true;

create index if not exists ix_universidades_activo on atlas.universidades(activo);
create index if not exists ix_cursos_activo        on atlas.cursos(activo);

-- ---------- 3. El perfil de egreso se cuelga del programa ----------

-- La unique inline de la 06 recibió nombre automático; se comprueba antes
-- de soltarla para que la migración sea reejecutable.
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'perfiles_egreso_universidad_id_key'
  ) then
    alter table atlas.perfiles_egreso
      drop constraint perfiles_egreso_universidad_id_key;
  end if;
end $$;

-- Perfiles guardados después de la 08 con el formulario antiguo quedaron
-- con programa_id nulo, y el agente nuevo los busca por programa. Se
-- rellena con el programa de esa universidad, sólo cuando es único: si
-- hubiera dos, elegir uno al azar asignaría el perfil al programa
-- equivocado sin que nadie lo notara.
update atlas.perfiles_egreso pe
set programa_id = p.id
from atlas.programas p
where p.universidad_id = pe.universidad_id
  and pe.programa_id is null
  and (select count(*) from atlas.programas q where q.universidad_id = pe.universidad_id) = 1
  and not exists (
    select 1 from atlas.perfiles_egreso otro
    where otro.programa_id = p.id and otro.id <> pe.id
  );

-- La unique por programa ya existe desde la 08; se garantiza por si esta
-- migración se aplica sobre una base donde la 08 se saltó.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uq_perfiles_egreso_programa'
  ) then
    alter table atlas.perfiles_egreso
      add constraint uq_perfiles_egreso_programa unique (programa_id);
  end if;
end $$;

-- ---------- Verificación ----------

do $$
declare
  v_nn_programa  text;
  v_unique_univ  int;
  v_sin_programa int;
begin
  select is_nullable into v_nn_programa
  from information_schema.columns
  where table_schema = 'atlas' and table_name = 'universidades'
    and column_name = 'programa';

  if v_nn_programa <> 'YES' then
    raise exception 'universidades.programa sigue siendo NOT NULL.';
  end if;

  select count(*) into v_unique_univ
  from pg_constraint where conname = 'perfiles_egreso_universidad_id_key';

  if v_unique_univ > 0 then
    raise exception 'perfiles_egreso sigue limitado a un perfil por universidad.';
  end if;

  select count(*) into v_sin_programa
  from atlas.perfiles_egreso where programa_id is null;

  if v_sin_programa > 0 then
    raise notice 'Quedan % perfiles de egreso sin programa: su universidad tiene varios y hay que asignarlo a mano.', v_sin_programa;
  end if;

  raise notice 'Edicion habilitada: universidades y cursos desactivables, perfil de egreso por programa.';
end $$;
