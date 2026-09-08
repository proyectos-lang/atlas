-- ============================================================
-- ATLAS · 00 · Esquema y dimensiones
-- Convenciones: esquema `atlas` (nunca public), nomenclatura en
-- español snake_case, PK numéricas, códigos de negocio como texto
-- con índice único. RLS deshabilitado: el control de acceso vive
-- en el servidor (lib/auth/alcance.ts).
-- ============================================================

create schema if not exists atlas;

-- ---------- Dimensiones ----------

create table if not exists atlas.universidades (
  id           bigint generated always as identity primary key,
  codigo       text not null unique,          -- U01, U02, U03
  universidad  text not null,
  programa     text not null,
  modalidad    text not null                  -- Virtual, Híbrida, Presencial
);

create table if not exists atlas.cursos (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,       -- C01, C02, C03
  nombre          text not null,
  universidad_id  bigint not null references atlas.universidades(id),
  semanas         int  not null default 6,
  periodo         text
);

create table if not exists atlas.usuarios (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,       -- E001..E036
  nombre          text not null,
  curso_id        bigint references atlas.cursos(id),
  universidad_id  bigint not null references atlas.universidades(id),
  rol             text not null,              -- Estudiante, Docente
  semestre        int
);

create table if not exists atlas.actividades (
  id           bigint generated always as identity primary key,
  codigo       text not null unique,          -- C01-A01
  curso_id     bigint not null references atlas.cursos(id),
  nombre       text not null,
  tipo         text not null,                 -- Proyecto, Foro, Caso, Problema, Reflexión
  competencia  text not null,
  ilo          text not null,                 -- RA1..RA5
  peso         numeric not null
);

create table if not exists atlas.semanas (
  numero    int primary key,                  -- 1..6
  etiqueta  text not null                     -- "Semana 1"
);

create index if not exists ix_cursos_universidad    on atlas.cursos(universidad_id);
create index if not exists ix_usuarios_curso        on atlas.usuarios(curso_id);
create index if not exists ix_usuarios_universidad  on atlas.usuarios(universidad_id);
create index if not exists ix_usuarios_rol          on atlas.usuarios(rol);
create index if not exists ix_actividades_curso     on atlas.actividades(curso_id);
