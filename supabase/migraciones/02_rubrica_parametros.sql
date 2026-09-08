-- ============================================================
-- ATLAS · 02 · Rúbrica, parámetros y catálogo
--
-- rubrica y parametros NO son datos de origen: no están en el Excel
-- y no deben estarlo. Son configuración y evaluación que se construyen
-- en la aplicación, en tablas ESCRIBIBLES (no vistas):
--   · parametros la edita el docente desde administración
--   · rubrica recibe calificaciones reales que reemplazan la semilla
--     fila por fila (es_semilla pasa a false)
-- ============================================================

-- ---------- Configuración: los seis criterios evaluables ----------
create table if not exists atlas.rubrica_criterios (
  id            bigint generated always as identity primary key,
  codigo_kpi    text not null unique,          -- NA, NS, EA, TD, NIA, UEA
  criterio      text not null,
  actividad     text not null,
  orden         int  not null,
  valor_maximo  numeric not null               -- numeric, NO float8 (ver 03_seed_rubrica)
);

-- ---------- Evaluación: un puntaje por estudiante, criterio y semana ----------
-- valor_maximo se denormaliza a propósito: si el docente cambia el máximo
-- de un criterio a mitad de período, las calificaciones ya emitidas
-- conservan su escala original.
create table if not exists atlas.rubrica (
  id              bigint generated always as identity primary key,
  usuario_id      bigint not null references atlas.usuarios(id),
  curso_id        bigint not null references atlas.cursos(id),
  semana          int    not null references atlas.semanas(numero),
  criterio_id     bigint not null references atlas.rubrica_criterios(id),
  valor_obtenido  numeric not null,
  valor_maximo    numeric not null,
  es_semilla      boolean not null default true,
  evaluado_por    bigint,                      -- FK a perfiles, se agrega en 04
  evaluado_en     timestamptz,
  unique (usuario_id, criterio_id, semana)
);

create index if not exists ix_rubrica_curso_semana on atlas.rubrica(curso_id, semana);
create index if not exists ix_rubrica_criterio     on atlas.rubrica(criterio_id);
create index if not exists ix_rubrica_semilla      on atlas.rubrica(es_semilla);

-- ---------- Parámetros por curso ----------
create table if not exists atlas.parametros (
  id          bigint generated always as identity primary key,
  curso_id    bigint not null references atlas.cursos(id),
  codigo_kpi  text not null,
  parametro   text not null,
  valor       numeric not null,
  unidad      text,
  origen      text not null default 'Supuesto',   -- Supuesto | Definido por docente
  unique (curso_id, codigo_kpi)
);

-- ---------- Catálogo de indicadores ----------
create table if not exists atlas.catalogo_kpi (
  id                   bigint generated always as identity primary key,
  orden                int  not null,
  codigo               text not null unique,
  nombre               text not null,
  competencia          text not null,
  nivel                text not null,   -- Índice | Sub-KPI | Índice Global | ILO | Global
  fuente               text,
  campos               text,
  formula_corta        text,
  escala               text not null,   -- Porcentaje | Puntos
  truncar_100          boolean not null default true,
  estado_dato          text not null,   -- Directo | Parámetro | Semilla | Derivado | Sin fuente
  peso                 numeric not null default 0,
  seguimiento_semanal  text not null    -- Sí | Parcial | No
);

-- ---------- Tabla heredada, solo validación ----------
-- La hoja KPIs_Competencias del Excel NO concuerda con los datos crudos
-- (correlación ~0). Se conserva para pruebas comparativas; ningún visual la lee.
create table if not exists atlas.kpis_competencias_origen (
  id              bigint generated always as identity primary key,
  usuario_codigo  text not null,
  curso_codigo    text not null,
  ite  numeric, iau numeric, icom numeric,
  ipc  numeric, irp numeric, ctg  numeric,
  unique (usuario_codigo)
);
