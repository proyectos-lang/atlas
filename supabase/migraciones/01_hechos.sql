-- ============================================================
-- ATLAS · 01 · Tablas de hechos
-- Volúmenes esperados del conjunto actual:
--   foros 216 · colaboracion 216 · moodle_logs 216
--   evaluaciones 180 · resultados_aprendizaje 180
-- ============================================================

create table if not exists atlas.foros (
  id                     bigint generated always as identity primary key,
  usuario_id             bigint not null references atlas.usuarios(id),
  curso_id               bigint not null references atlas.cursos(id),
  semana                 int not null references atlas.semanas(numero),
  intervenciones         int not null default 0,
  respuestas_emitidas    int not null default 0,
  respuestas_recibidas   int not null default 0,
  calidad_argumentativa  numeric,             -- 0..100
  unique (usuario_id, semana)
);

create table if not exists atlas.colaboracion (
  id                bigint generated always as identity primary key,
  usuario_id        bigint not null references atlas.usuarios(id),
  curso_id          bigint not null references atlas.cursos(id),
  semana            int not null references atlas.semanas(numero),
  aportes           int not null default 0,
  interacciones     int not null default 0,
  evaluacion_pares  numeric,                  -- 0..100
  rol_grupo         text,                     -- Coordinador, Miembro, Líder
  unique (usuario_id, semana)
);

create table if not exists atlas.moodle_logs (
  id                     bigint generated always as identity primary key,
  usuario_id             bigint not null references atlas.usuarios(id),
  curso_id               bigint not null references atlas.cursos(id),
  semana                 int not null references atlas.semanas(numero),
  accesos                int not null default 0,
  minutos                int not null default 0,
  recursos_consultados   int not null default 0,
  actividades_visitadas  int not null default 0,
  unique (usuario_id, semana)
);

-- `semana` es nulable a propósito: no existe en el Excel de origen.
-- Cuando está vacía, los indicadores derivados devuelven el mismo valor
-- en todas las semanas; eso se expone en la UI vía catalogo_kpi.seguimiento_semanal.
create table if not exists atlas.evaluaciones (
  id              bigint generated always as identity primary key,
  usuario_id      bigint not null references atlas.usuarios(id),
  curso_id        bigint not null references atlas.cursos(id),
  actividad_id    bigint references atlas.actividades(id),
  semana          int references atlas.semanas(numero),
  calificacion    numeric not null,
  puntaje_maximo  numeric not null default 100,
  entrega_puntual boolean not null,
  unique (usuario_id, actividad_id)
);

create table if not exists atlas.resultados_aprendizaje (
  id                bigint generated always as identity primary key,
  usuario_id        bigint not null references atlas.usuarios(id),
  curso_id          bigint not null references atlas.cursos(id),
  semana            int references atlas.semanas(numero),
  ilo               text not null,            -- RA1..RA5
  competencia       text not null,
  logro_porcentaje  numeric not null,
  nivel             text,
  unique (usuario_id, ilo)
);

create index if not exists ix_foros_usuario         on atlas.foros(usuario_id);
create index if not exists ix_foros_curso_semana    on atlas.foros(curso_id, semana);
create index if not exists ix_colab_usuario         on atlas.colaboracion(usuario_id);
create index if not exists ix_colab_curso_semana    on atlas.colaboracion(curso_id, semana);
create index if not exists ix_logs_usuario          on atlas.moodle_logs(usuario_id);
create index if not exists ix_logs_curso_semana     on atlas.moodle_logs(curso_id, semana);
create index if not exists ix_eval_usuario          on atlas.evaluaciones(usuario_id);
create index if not exists ix_eval_curso            on atlas.evaluaciones(curso_id);
create index if not exists ix_ra_usuario            on atlas.resultados_aprendizaje(usuario_id);
create index if not exists ix_ra_curso              on atlas.resultados_aprendizaje(curso_id);
