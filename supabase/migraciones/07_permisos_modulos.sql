-- ============================================================
-- ATLAS · 07 · Permisos de módulo por perfil
-- ============================================================

-- Hasta aquí, las pantallas que veía alguien dependían sólo de su rol
-- (RUTAS_POR_ROL en lib/auth/alcance.ts). Esta columna permite ajustar
-- esa lista perfil por perfil, sin inventar roles nuevos.
--
-- CUIDADO AL LEER ESTO: un módulo es una PANTALLA, no un permiso sobre
-- datos. Conceder `/administrador` a un docente le muestra el tablero
-- institucional, pero poblado únicamente con los datos de su curso: el
-- Alcance sigue mandando sobre qué filas se consultan y no se toca aquí.
--
-- NULL significa "sin personalizar": el perfil usa exactamente las rutas
-- de su rol. Se distingue a propósito del array vacío, que significa
-- "sin ningún módulo" y deja al perfil sin nada que ver. Una columna con
-- DEFAULT '{}' habría convertido a todos los perfiles existentes en
-- perfiles sin acceso.
alter table atlas.perfiles
  add column if not exists modulos text[];

comment on column atlas.perfiles.modulos is
  'Rutas de módulo que este perfil puede ver. NULL = usar las del rol. '
  'Array vacío = ningún módulo. No amplía el alcance de datos.';

-- Validación de forma. Un CHECK no admite subconsultas, así que la
-- comprobación vive en una función inmutable.
create or replace function atlas.modulos_bien_formados(p_modulos text[])
returns boolean
language sql immutable as $$
  select p_modulos is null
      or not exists (
           select 1
           from unnest(p_modulos) r
           where r !~ '^/[A-Za-z0-9/_-]{1,99}$'
         );
$$;

-- Sin esto, una ruta mal escrita se guardaría en silencio y el módulo
-- simplemente no aparecería, sin que nadie supiera por qué.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ck_perfiles_modulos_ruta'
  ) then
    alter table atlas.perfiles
      add constraint ck_perfiles_modulos_ruta
      check (atlas.modulos_bien_formados(modulos));
  end if;
end $$;

create index if not exists ix_perfiles_modulos
  on atlas.perfiles using gin (modulos);
