-- ============================================================
-- ATLAS · 09 · Modelo curricular macro / meso / micro
-- ============================================================

-- Trazabilidad que habilita este esquema:
--
--   Institución → Facultad → Programa            (MACRO)
--     → Área de formación → Línea → Semestre      (MESO)
--       → Asignatura → Unidad → Actividad         (MICRO)
--         → Resultado de aprendizaje → Competencia
--           → Indicador → Evidencia → Dato
--
-- Convive con el modelo anterior sin romperlo: `universidades`, `cursos` y
-- `actividades` siguen intactos y son quienes alimentan hoy el motor. Las
-- tablas nuevas nacen vacías y se pueblan desde la aplicación; las que
-- duplican conceptos llevan una FK opcional al equivalente antiguo para
-- que el puente exista cuando haga falta.
--
-- ES IDEMPOTENTE.

-- ============================================================
-- MACROCURRICULAR
-- ============================================================

-- La institución es el nivel que faltaba por encima de `universidades`.
-- No se fusiona con ella: `universidades` está referenciada por los datos
-- de hechos y renombrarla obligaría a tocar el motor.
create table if not exists atlas.instituciones (
  id           bigint generated always as identity primary key,
  codigo       text not null unique,
  nombre       text not null,
  siglas       text,
  pais         text,
  -- Puente con el modelo anterior: una institución puede corresponder a
  -- una fila de `universidades` mientras coexistan ambos modelos.
  universidad_id bigint references atlas.universidades(id),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);

create table if not exists atlas.facultades (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,
  nombre          text not null,
  institucion_id  bigint not null references atlas.instituciones(id),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  unique (institucion_id, nombre)
);

create index if not exists ix_facultades_institucion
  on atlas.facultades(institucion_id);

-- Datos macro del programa. Se separan de `programas` en vez de añadirse
-- como columnas porque son textos largos de documento curricular y porque
-- `programas` participa en el alcance, que conviene mantener ligero.
create table if not exists atlas.programas_macro (
  id                  bigint generated always as identity primary key,
  programa_id         bigint not null unique references atlas.programas(id),
  facultad_id         bigint references atlas.facultades(id),

  perfil_egreso       text,
  propositos          text,      -- Propósitos de formación
  plan_estudios       text,      -- Plan general de estudios
  modalidad           text,      -- Virtual, Híbrida, Presencial
  nivel               text,      -- Pregrado, Posgrado…
  duracion_semestres  int,

  -- ABET adoptado por el programa. Que esté vacío no impide nada: es
  -- articulación opcional, no un requisito del modelo.
  abet_adoptado       boolean not null default false,

  actualizado_por     bigint references atlas.perfiles(id),
  actualizado_en      timestamptz not null default now(),
  creado_en           timestamptz not null default now()
);

create index if not exists ix_programas_macro_facultad
  on atlas.programas_macro(facultad_id);

-- ============================================================
-- COMPETENCIAS Y RESULTADOS DE APRENDIZAJE
-- ============================================================

-- Las cinco competencias transversales del modelo, más las que cada
-- programa quiera añadir. `transversal` las distingue de las específicas
-- de disciplina.
create table if not exists atlas.competencias (
  id            bigint generated always as identity primary key,
  codigo        text not null unique,          -- CE, PC, RP, TE, AA
  nombre        text not null,
  descripcion   text,
  transversal   boolean not null default true,

  -- Correspondencia ABET. `student_outcome` vacío con `transversal` en
  -- true identifica una competencia transversal COMPLEMENTARIA: la que el
  -- modelo trabaja pero no corresponde a ningún Student Outcome directo.
  student_outcome text,                        -- SO1..SO7 de ABET
  programa_id   bigint references atlas.programas(id),  -- null = global
  activo        boolean not null default true,
  orden         int not null default 0,
  creado_en     timestamptz not null default now()
);

create index if not exists ix_competencias_programa on atlas.competencias(programa_id);

-- Resultados de aprendizaje, en los tres niveles. `ambito` dice a qué
-- nivel pertenece cada uno; las FK correspondientes quedan pobladas según
-- ese ámbito y las demás en null.
create table if not exists atlas.resultados (
  id             bigint generated always as identity primary key,
  codigo         text not null,                -- RA1, RAP01, RAC03…
  enunciado      text not null,
  ambito         text not null,                -- Programa | Area | Curso

  programa_id    bigint references atlas.programas(id),
  area_id        bigint,                       -- FK diferida: areas nace abajo
  curso_id       bigint references atlas.cursos(id),

  competencia_id bigint references atlas.competencias(id),
  activo         boolean not null default true,
  orden          int not null default 0,
  creado_en      timestamptz not null default now(),

  constraint ck_resultados_ambito
    check (ambito in ('Programa', 'Area', 'Curso')),
  unique (codigo, programa_id, curso_id)
);

create index if not exists ix_resultados_programa    on atlas.resultados(programa_id);
create index if not exists ix_resultados_curso       on atlas.resultados(curso_id);
create index if not exists ix_resultados_competencia on atlas.resultados(competencia_id);

-- ============================================================
-- MESOCURRICULAR
-- ============================================================

create table if not exists atlas.areas (
  id            bigint generated always as identity primary key,
  codigo        text not null unique,
  nombre        text not null,
  tipo          text,                           -- Área | Componente
  programa_id   bigint not null references atlas.programas(id),
  descripcion   text,
  activo        boolean not null default true,
  orden         int not null default 0,
  creado_en     timestamptz not null default now(),
  unique (programa_id, nombre)
);

create index if not exists ix_areas_programa on atlas.areas(programa_id);

-- La FK de resultados.area_id se cierra aquí, una vez que areas existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_resultados_area'
  ) then
    alter table atlas.resultados
      add constraint fk_resultados_area
      foreign key (area_id) references atlas.areas(id);
  end if;
end $$;

create table if not exists atlas.lineas_curriculares (
  id           bigint generated always as identity primary key,
  codigo       text not null unique,
  nombre       text not null,
  programa_id  bigint not null references atlas.programas(id),
  descripcion  text,
  activo       boolean not null default true,
  orden        int not null default 0,
  creado_en    timestamptz not null default now(),
  unique (programa_id, nombre)
);

create index if not exists ix_lineas_programa on atlas.lineas_curriculares(programa_id);

-- Ubicación de cada asignatura en el plan: área, línea y semestre.
-- Es una tabla aparte y no columnas en `cursos` porque una asignatura
-- puede pertenecer a varias áreas, y porque `cursos` alimenta el motor.
create table if not exists atlas.cursos_meso (
  id           bigint generated always as identity primary key,
  curso_id     bigint not null references atlas.cursos(id),
  area_id      bigint references atlas.areas(id),
  linea_id     bigint references atlas.lineas_curriculares(id),
  semestre     int,
  creditos     numeric,
  creado_en    timestamptz not null default now(),
  unique (curso_id, area_id, linea_id)
);

create index if not exists ix_cursos_meso_curso on atlas.cursos_meso(curso_id);
create index if not exists ix_cursos_meso_area  on atlas.cursos_meso(area_id);

-- Qué competencias se desarrollan en cada área. Relación N:N.
create table if not exists atlas.area_competencias (
  area_id        bigint not null references atlas.areas(id),
  competencia_id bigint not null references atlas.competencias(id),
  nivel          text,                          -- Introduce | Refuerza | Consolida
  primary key (area_id, competencia_id)
);

-- ============================================================
-- MICROCURRICULAR
-- ============================================================

-- Datos micro de la asignatura. Como con `programas_macro`, se separa de
-- `cursos` para no engordar la tabla que usa el alcance.
create table if not exists atlas.cursos_micro (
  id                bigint generated always as identity primary key,
  curso_id          bigint not null unique references atlas.cursos(id),
  descripcion       text,
  justificacion     text,
  metodologia       text,                       -- Estrategias pedagógicas
  evaluacion        text,                       -- Estrategias de evaluación
  actualizado_por   bigint references atlas.perfiles(id),
  actualizado_en    timestamptz not null default now(),
  creado_en         timestamptz not null default now()
);

create table if not exists atlas.unidades (
  id           bigint generated always as identity primary key,
  codigo       text not null,
  nombre       text not null,
  curso_id     bigint not null references atlas.cursos(id),
  descripcion  text,
  semana_inicio int,
  semana_fin    int,
  orden        int not null default 0,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  unique (curso_id, codigo)
);

create index if not exists ix_unidades_curso on atlas.unidades(curso_id);

-- Qué competencias desarrolla cada asignatura, y a qué nivel.
create table if not exists atlas.curso_competencias (
  curso_id       bigint not null references atlas.cursos(id),
  competencia_id bigint not null references atlas.competencias(id),
  nivel          text,
  primary key (curso_id, competencia_id)
);

-- ============================================================
-- INDICADORES: competencia → dimensión → indicador
-- ============================================================

-- La dimensión es el nivel que faltaba. El modelo anterior iba de la
-- competencia directamente a un sub-indicador con fórmula fija; aquí una
-- competencia se descompone en dimensiones observables (comprensión del
-- problema, descomposición, depuración…) y cada una se mide con uno o más
-- indicadores.
create table if not exists atlas.dimensiones (
  id             bigint generated always as identity primary key,
  codigo         text not null unique,
  nombre         text not null,
  descripcion    text,
  competencia_id bigint not null references atlas.competencias(id),
  orden          int not null default 0,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  unique (competencia_id, nombre)
);

create index if not exists ix_dimensiones_competencia
  on atlas.dimensiones(competencia_id);

-- Indicadores configurables. A diferencia de los 22 sub-indicadores del
-- motor anterior --fórmulas literales dentro de kpi_estudiante()-- estos
-- se definen desde la aplicación.
--
-- `agregacion` y `parametros` describen CÓMO se calcula el indicador a
-- partir de las evidencias asociadas, sin que la fórmula viva en SQL:
--   Promedio    media de los valores de las evidencias
--   Suma        suma, contrastada con `valor_esperado`
--   Proporcion  cuántas evidencias superan `umbral`, sobre el total
--   Conteo      número de evidencias
--   Rubrica     suma de obtenido sobre suma de máximo
create table if not exists atlas.indicadores (
  id              bigint generated always as identity primary key,
  codigo          text not null unique,
  nombre          text not null,
  descripcion     text,
  dimension_id    bigint not null references atlas.dimensiones(id),

  agregacion      text not null default 'Promedio',
  valor_esperado  numeric,                      -- denominador, si aplica
  umbral          numeric,                      -- corte de 'Proporcion'
  escala          text not null default 'Porcentaje',  -- Porcentaje | Puntos
  trunca_100      boolean not null default true,
  prorratea       boolean not null default false,

  -- Ámbito opcional: un indicador puede ser global o propio de un curso.
  curso_id        bigint references atlas.cursos(id),

  activo          boolean not null default true,
  orden           int not null default 0,
  creado_en       timestamptz not null default now(),

  constraint ck_indicadores_agregacion
    check (agregacion in ('Promedio', 'Suma', 'Proporcion', 'Conteo', 'Rubrica')),
  constraint ck_indicadores_escala
    check (escala in ('Porcentaje', 'Puntos'))
);

create index if not exists ix_indicadores_dimension on atlas.indicadores(dimension_id);
create index if not exists ix_indicadores_curso     on atlas.indicadores(curso_id);

-- Qué indicadores evidencia cada resultado de aprendizaje. N:N: un RA se
-- observa con varios indicadores y un indicador puede servir a varios RA.
create table if not exists atlas.resultado_indicadores (
  resultado_id  bigint not null references atlas.resultados(id),
  indicador_id  bigint not null references atlas.indicadores(id),
  peso          numeric not null default 1,
  primary key (resultado_id, indicador_id)
);

-- ============================================================
-- Verificación
-- ============================================================

do $$
declare v_tablas int;
begin
  select count(*) into v_tablas
  from information_schema.tables
  where table_schema = 'atlas'
    and table_name in (
      'instituciones', 'facultades', 'programas_macro', 'competencias',
      'resultados', 'areas', 'lineas_curriculares', 'cursos_meso',
      'area_competencias', 'cursos_micro', 'unidades', 'curso_competencias',
      'dimensiones', 'indicadores', 'resultado_indicadores'
    );

  if v_tablas <> 15 then
    raise exception 'Se esperaban 15 tablas del modelo curricular, hay %.', v_tablas;
  end if;

  raise notice 'Modelo curricular macro-meso-micro creado: 15 tablas.';
end $$;
