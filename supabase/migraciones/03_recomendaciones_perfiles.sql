-- ============================================================
-- ATLAS · 03 · Recomendaciones del agente y perfiles
-- ============================================================

-- Estructura base tomada de la hoja Recomendaciones_IA del Excel:
--   ID_Recomendacion · ID_Curso · ID_Estudiante · Tipo · Competencia
--   Nivel_Actual · Nivel_Meta · Brecha · Recomendacion · Estado
-- más los campos de seguimiento que NO existen en el modelo actual y
-- sin los cuales TAR, NRA, TRR y EIA no se pueden calcular.
create table if not exists atlas.recomendaciones_ia (
  id            bigint generated always as identity primary key,
  codigo        text not null unique,          -- R001, R002...
  curso_id      bigint not null references atlas.cursos(id),
  usuario_id    bigint references atlas.usuarios(id),   -- null cuando tipo = 'Grupal'
  tipo          text not null,                 -- Individual | Grupal
  competencia   text not null,
  nivel_actual  text not null,
  nivel_meta    text not null,
  brecha        numeric not null,
  recomendacion text not null,
  estado        text not null default 'Pendiente de revisión docente',

  -- Seguimiento (habilita TAR, NRA, TRR, EIA)
  aplicada         boolean not null default false,
  fecha_emision    timestamptz not null default now(),
  fecha_respuesta  timestamptz,
  fecha_aplicacion timestamptz,
  valor_antes      numeric,
  valor_despues    numeric,
  generada_por     text not null default 'agente-ia',
  modelo           text,
  tokens_usados    int,

  -- Trazabilidad adicional del agente
  justificacion         text,
  sub_indicador_critico text,

  constraint ck_reco_estado check (estado in (
    'Pendiente de revisión docente', 'Aprobada', 'Rechazada', 'Implementada')),
  constraint ck_reco_tipo check (tipo in ('Individual', 'Grupal')),
  -- Una recomendación grupal no apunta a un estudiante; una individual sí.
  constraint ck_reco_destinatario check (
    (tipo = 'Grupal'     and usuario_id is null) or
    (tipo = 'Individual' and usuario_id is not null))
);

create index if not exists ix_reco_curso   on atlas.recomendaciones_ia(curso_id);
create index if not exists ix_reco_usuario on atlas.recomendaciones_ia(usuario_id);
create index if not exists ix_reco_estado  on atlas.recomendaciones_ia(estado);

-- ---------- Perfiles ----------
create table if not exists atlas.perfiles (
  id              bigint generated always as identity primary key,
  auth_user_id    uuid not null unique,        -- referencia a auth.users
  nombre          text not null,
  email           text not null,
  rol             text not null,               -- admin|coordinador|asesor|docente|estudiante
  universidad_id  bigint references atlas.universidades(id),
  curso_id        bigint references atlas.cursos(id),
  usuario_id      bigint references atlas.usuarios(id),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  constraint ck_perfil_rol check (rol in
    ('admin', 'coordinador', 'asesor', 'docente', 'estudiante'))
);

create index if not exists ix_perfiles_rol   on atlas.perfiles(rol);
create index if not exists ix_perfiles_email on atlas.perfiles(email);

-- La FK de rubrica.evaluado_por se cierra aquí, una vez que perfiles existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_rubrica_evaluado_por'
  ) then
    alter table atlas.rubrica
      add constraint fk_rubrica_evaluado_por
      foreign key (evaluado_por) references atlas.perfiles(id);
  end if;
end $$;
