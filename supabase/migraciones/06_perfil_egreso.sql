-- ============================================================
-- ATLAS · 06 · Perfil de egreso por programa
-- ============================================================

-- El perfil de egreso es el documento curricular que declara qué debe
-- saber hacer quien termina el programa. Alimenta al agente de IA: sin
-- él las recomendaciones se apoyan sólo en los indicadores; con él
-- pueden alinearse con lo que el programa promete formar.
--
-- Se asocia a `universidades`, no a `cursos`, porque cada fila de
-- universidades YA es un par (universidad, programa) --ver la columna
-- `programa` en 00_esquema.sql--. El perfil de egreso pertenece al
-- programa, nunca a una asignatura suelta.
--
-- Relación 1 a 1 con universidades: `universidad_id` es unique. Editar
-- el perfil reemplaza el texto; no se versiona (si en el futuro hiciera
-- falta historial, esta tabla pasa a ser la vista de la última versión).
create table if not exists atlas.perfiles_egreso (
  id              bigint generated always as identity primary key,
  universidad_id  bigint not null unique references atlas.universidades(id),

  -- El perfil tal como aparece en el documento curricular. Texto libre:
  -- el agente lo lee entero, no se parsea ni se trocea.
  perfil_egreso   text not null,

  -- Contexto opcional que afina la recomendación sin ser el perfil.
  notas           text,

  -- Un perfil inactivo se conserva pero no entra al contexto del agente.
  activo          boolean not null default true,

  actualizado_por bigint references atlas.perfiles(id),
  actualizado_en  timestamptz not null default now(),
  creado_en       timestamptz not null default now(),

  -- Un perfil vacío es peor que ninguno: daría contexto en blanco al
  -- agente sin que nadie lo note. Se exige contenido real.
  constraint ck_perfil_egreso_no_vacio
    check (length(btrim(perfil_egreso)) >= 20)
);

create index if not exists ix_perfiles_egreso_activo
  on atlas.perfiles_egreso(activo);

-- `actualizado_en` se mantiene solo: la aplicación no debe recordarlo.
create or replace function atlas.tocar_perfil_egreso()
returns trigger
language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists tg_perfiles_egreso_tocar on atlas.perfiles_egreso;
create trigger tg_perfiles_egreso_tocar
  before update on atlas.perfiles_egreso
  for each row execute function atlas.tocar_perfil_egreso();
