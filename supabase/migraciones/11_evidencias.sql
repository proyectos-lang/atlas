-- ============================================================
-- ATLAS · 11 · Fuentes de datos, mapeo y evidencias
-- ============================================================

-- Este es el cambio que desacopla ATLAS de Moodle.
--
-- Hasta aquí, el origen de los datos estaba cableado en el esquema:
-- `moodle_logs`, `foros` y `colaboracion` son tablas con forma de Moodle,
-- y cinco sub-indicadores leen de ellas directamente. Un curso presencial
-- sin LMS no tenía dónde registrar nada.
--
-- A partir de aquí el LMS es UNA FUENTE MÁS. La cadena queda:
--
--   Fuente → dato → evidencia → indicador → competencia → RA
--
-- `evidencias` es la tabla central: cada fila es un dato observado sobre
-- un estudiante, con su procedencia y su trazabilidad completa. Da igual
-- si vino de Moodle, de GitHub, de una rúbrica en papel o de la
-- observación del docente.
--
-- NO TOCA NADA DE LO EXISTENTE. Las tablas de hechos actuales siguen
-- alimentando el motor antiguo mientras convivan los dos modelos.
--
-- ES IDEMPOTENTE.

-- ---------- 1. Catálogo de fuentes ----------

-- `categoria` separa lo que necesita integración de lo que no:
--   LMS          Moodle, Canvas, Blackboard…
--   Colaborativa Teams, Google Workspace, Miro, documentos compartidos
--   Codigo       GitHub, GitLab, IDE
--   Formulario   Forms, Mentimeter, encuestas
--   Instrumento  rúbricas, autoevaluación, coevaluación
--   Observacion  registro directo del docente
--   Archivo      CSV, XLSX y otras fuentes estructuradas
--
-- `modo_ingreso` dice cómo llegan los datos: por API o cargados a mano.
-- Una misma herramienta puede aparecer dos veces con modos distintos.
create table if not exists atlas.fuentes_datos (
  id            bigint generated always as identity primary key,
  codigo        text not null unique,
  nombre        text not null,
  categoria     text not null,
  modo_ingreso  text not null default 'Carga',
  descripcion   text,

  -- Configuración de conexión, sólo para fuentes con API. Nunca guarda
  -- credenciales: las claves viven en variables de entorno.
  config        jsonb,

  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),

  constraint ck_fuentes_categoria check (categoria in (
    'LMS', 'Colaborativa', 'Codigo', 'Formulario',
    'Instrumento', 'Observacion', 'Archivo'
  )),
  constraint ck_fuentes_modo check (modo_ingreso in ('API', 'Carga', 'Manual'))
);

create index if not exists ix_fuentes_categoria on atlas.fuentes_datos(categoria);

-- ---------- 2. Mapeo fuente → indicador ----------

-- Es la pieza que permite añadir una herramienta nueva sin tocar la
-- arquitectura: basta con declarar qué variable suya alimenta qué
-- indicador, y con qué transformación.
--
--   Moodle   entregas          → Cumplimiento    → Aprendizaje Autónomo
--   GitHub   contribuciones    → Participación   → Trabajo en Equipo
--   Forms    argumentación     → Justificación   → Pensamiento Crítico
--   Rúbrica  nivel obtenido    → Logro           → la que corresponda
--   IDE      errores corregidos→ Depuración      → Resolución de Problemas
create table if not exists atlas.mapeos (
  id            bigint generated always as identity primary key,
  fuente_id     bigint not null references atlas.fuentes_datos(id),
  indicador_id  bigint not null references atlas.indicadores(id),

  -- Nombre de la variable EN LA FUENTE. Es la columna del CSV o el campo
  -- de la API, tal cual viene; no se normaliza para que el docente
  -- reconozca su propio dato.
  variable      text not null,

  -- Transformación al valor del indicador:
  --   Directo    el valor se usa tal cual
  --   Escalar    valor * factor
  --   Normalizar 100 * valor / valor_maximo
  --   Booleano   true → 100, false → 0
  transformacion text not null default 'Directo',
  factor         numeric,
  valor_maximo   numeric,

  curso_id      bigint references atlas.cursos(id),   -- null = aplica a todos
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),

  constraint ck_mapeos_transformacion
    check (transformacion in ('Directo', 'Escalar', 'Normalizar', 'Booleano')),

  -- Una variable de una fuente alimenta un indicador una sola vez por
  -- curso; si no, el mismo dato entraría dos veces al promedio.
  unique (fuente_id, variable, indicador_id, curso_id)
);

create index if not exists ix_mapeos_fuente    on atlas.mapeos(fuente_id);
create index if not exists ix_mapeos_indicador on atlas.mapeos(indicador_id);

-- ---------- 3. Evidencias: la tabla central ----------

-- Cada fila es un dato observado sobre un estudiante, con su origen y su
-- trazabilidad. Es lo que permite responder "¿de dónde salió este número?"
-- para cualquier indicador.
--
-- Ejemplo del enunciado:
--   E001 → Programación → "Reto algorítmico" → RA02 → Resolución de
--   Problemas → Depuración → GitHub → 4 errores corregidos → nivel
create table if not exists atlas.evidencias (
  id             bigint generated always as identity primary key,

  -- Quién y dónde
  usuario_id     bigint not null references atlas.usuarios(id),
  curso_id       bigint not null references atlas.cursos(id),
  grupo_id       bigint references atlas.grupos(id),
  actividad_id   bigint references atlas.actividades(id),

  -- Qué se está midiendo
  indicador_id   bigint not null references atlas.indicadores(id),
  resultado_id   bigint references atlas.resultados(id),

  -- De dónde vino
  fuente_id      bigint not null references atlas.fuentes_datos(id),
  variable       text,

  -- El dato. `valor` es el número ya transformado por el mapeo;
  -- `valor_bruto` conserva lo que dijo la fuente, sin tocar, para poder
  -- auditar la transformación o rehacerla si el mapeo cambia.
  valor          numeric not null,
  valor_bruto    numeric,
  valor_maximo   numeric,
  unidad         text,

  -- Cuándo
  semana         int references atlas.semanas(numero),
  fecha          timestamptz not null default now(),

  -- Procedencia del registro
  registrado_por bigint references atlas.perfiles(id),
  lote_id        bigint,                -- carga masiva que la trajo
  observaciones  text,

  creado_en      timestamptz not null default now()
);

create index if not exists ix_evidencias_usuario    on atlas.evidencias(usuario_id);
create index if not exists ix_evidencias_curso      on atlas.evidencias(curso_id);
create index if not exists ix_evidencias_indicador  on atlas.evidencias(indicador_id);
create index if not exists ix_evidencias_fuente     on atlas.evidencias(fuente_id);
create index if not exists ix_evidencias_semana     on atlas.evidencias(semana);
create index if not exists ix_evidencias_lote       on atlas.evidencias(lote_id);

-- Índice compuesto para la consulta más frecuente del motor: todas las
-- evidencias de un indicador para un estudiante en un ámbito.
create index if not exists ix_evidencias_calculo
  on atlas.evidencias(indicador_id, usuario_id, semana);

-- ---------- 4. Lotes de carga ----------

-- Toda carga masiva deja rastro: qué archivo, quién, cuándo, cuántas
-- filas entraron y cuántas se rechazaron. Sin esto, un CSV mal formado
-- contaminaría los indicadores sin dejar forma de revertirlo.
create table if not exists atlas.lotes_carga (
  id              bigint generated always as identity primary key,
  fuente_id       bigint not null references atlas.fuentes_datos(id),
  curso_id        bigint references atlas.cursos(id),

  nombre_archivo  text,
  estado          text not null default 'Procesando',
  filas_leidas    int not null default 0,
  filas_cargadas  int not null default 0,
  filas_rechazadas int not null default 0,
  errores         jsonb,

  cargado_por     bigint references atlas.perfiles(id),
  creado_en       timestamptz not null default now(),
  terminado_en    timestamptz,

  constraint ck_lotes_estado
    check (estado in ('Procesando', 'Completado', 'Fallido', 'Revertido'))
);

create index if not exists ix_lotes_fuente on atlas.lotes_carga(fuente_id);

-- La FK de evidencias.lote_id se cierra aquí, una vez que lotes existe.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_evidencias_lote'
  ) then
    alter table atlas.evidencias
      add constraint fk_evidencias_lote
      foreign key (lote_id) references atlas.lotes_carga(id);
  end if;
end $$;

-- ---------- 5. Semilla del catálogo de fuentes ----------

-- Las fuentes que el modelo contempla. Es configuración editable: el
-- administrador añade o desactiva desde la aplicación.
insert into atlas.fuentes_datos (codigo, nombre, categoria, modo_ingreso, descripcion)
values
  -- Con LMS
  ('MOODLE',   'Moodle',            'LMS',          'API',
   'Registros de actividad, entregas y foros del LMS.'),
  ('CANVAS',   'Canvas',            'LMS',          'API',  'LMS de Instructure.'),
  ('BLACKBOARD','Blackboard',       'LMS',          'API',  'LMS de Anthology.'),
  ('LMS_OTRO', 'Otro LMS',          'LMS',          'Carga',
   'Cualquier LMS que exporte a CSV o XLSX.'),

  -- Sin LMS: colaborativas
  ('TEAMS',    'Microsoft Teams',   'Colaborativa', 'API',
   'Participación en reuniones y canales.'),
  ('GOOGLE',   'Google Workspace',  'Colaborativa', 'API',
   'Documentos compartidos y actividad colaborativa.'),
  ('MIRO',     'Miro',              'Colaborativa', 'Carga',
   'Aportes en tableros colaborativos.'),
  ('DOCS',     'Documentos colaborativos', 'Colaborativa', 'Carga',
   'Historial de edición de documentos compartidos.'),

  -- Sin LMS: código
  ('GITHUB',   'GitHub',            'Codigo',       'API',
   'Commits, issues, pull requests y revisiones.'),
  ('GITLAB',   'GitLab',            'Codigo',       'API',  'Equivalente a GitHub.'),
  ('IDE',      'Entorno de programación', 'Codigo', 'Carga',
   'Errores corregidos, pruebas ejecutadas, sesiones de depuración.'),

  -- Sin LMS: formularios
  ('FORMS',    'Formularios',       'Formulario',   'Carga',
   'Respuestas de Google Forms, Microsoft Forms o similares.'),
  ('MENTIMETER','Mentimeter',       'Formulario',   'Carga',
   'Respuestas en tiempo real durante la clase.'),

  -- Instrumentos pedagógicos
  ('RUBRICA',  'Rúbrica',           'Instrumento',  'Manual',
   'Niveles de logro asignados por el docente.'),
  ('AUTOEVAL', 'Autoevaluación',    'Instrumento',  'Carga',
   'Valoración del propio estudiante.'),
  ('COEVAL',   'Coevaluación',      'Instrumento',  'Carga',
   'Valoración entre pares.'),

  -- Observación directa
  ('OBSERVA',  'Observación docente','Observacion', 'Manual',
   'Registro directo del docente en clase. No requiere ninguna herramienta.'),

  -- Archivos
  ('CSV',      'Archivo CSV/XLSX',  'Archivo',      'Carga',
   'Cualquier fuente estructurada que no tenga integración propia.')
on conflict (codigo) do nothing;

-- ---------- 6. Verificación ----------

do $$
declare
  v_fuentes    int;
  v_sin_lms    int;
  v_tablas     int;
begin
  select count(*) into v_tablas
  from information_schema.tables
  where table_schema = 'atlas'
    and table_name in ('fuentes_datos', 'mapeos', 'evidencias', 'lotes_carga');

  if v_tablas <> 4 then
    raise exception 'Se esperaban 4 tablas, hay %.', v_tablas;
  end if;

  select count(*) into v_fuentes from atlas.fuentes_datos;

  -- El principio del modelo: ATLAS debe servir sin LMS. Si todas las
  -- fuentes fueran LMS, el sistema seguiría atado a una plataforma.
  select count(*) into v_sin_lms
  from atlas.fuentes_datos where categoria <> 'LMS';

  if v_sin_lms = 0 then
    raise exception 'No hay ninguna fuente sin LMS: ATLAS seguiria atado a una plataforma.';
  end if;

  raise notice 'Fuentes: % en total, % sin LMS.', v_fuentes, v_sin_lms;
end $$;
