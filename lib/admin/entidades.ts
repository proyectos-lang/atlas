import type { Rol } from '@/lib/auth/alcance'

/**
 * Catálogo de entidades que se pueden editar y eliminar desde la
 * aplicación.
 *
 * Es una LISTA BLANCA. Una acción genérica de edición que aceptara
 * cualquier tabla y cualquier columna del formulario sería una puerta
 * abierta: bastaría manipular el nombre del campo para tocar `activo` de
 * un perfil ajeno o el `rol` de uno mismo. Aquí se declara, tabla por
 * tabla, exactamente qué columnas admiten cambios y quién puede hacerlos.
 *
 * `alcance` nombra la columna que ata la fila a un programa o curso: es
 * lo que permite comprobar que un coordinador sólo edite lo suyo. Las
 * entidades sin ella (instituciones, fuentes, competencias globales) son
 * sólo del administrador.
 */

export type TipoCampo = 'texto' | 'largo' | 'numero' | 'opcion'

export interface CampoEditable {
  columna: string
  etiqueta: string
  tipo: TipoCampo
  /** Para `opcion`: los valores admitidos. Lo demás se rechaza. */
  opciones?: readonly string[]
  /** Longitud mínima para texto; impide dejar un nombre vacío. */
  minimo?: number
  maximo?: number
}

export interface Entidad {
  tabla: string
  /** Singular con artículo, para mensajes: «la universidad», «el curso». */
  etiqueta: string
  /** Columna que identifica a la fila en pantalla. */
  nombre: string
  campos: readonly CampoEditable[]
  roles: readonly Rol[]
  /** `activo` existe: se puede desactivar en vez de borrar. */
  desactivable: boolean
  /**
   * Columna de alcance para coordinadores, si aplica. `por_ambito` es el
   * caso de los resultados de aprendizaje: cuelgan de programa, área o
   * curso según la fila, y se resuelve mirando cuál de las tres trae.
   */
  alcance?: 'programa_id' | 'curso_id' | 'universidad_id' | 'por_ambito'
  /** Qué tablas apuntan a esta. Si alguna tiene filas, no se borra. */
  dependientes: readonly { tabla: string; columna: string; etiqueta: string }[]
}

const CODIGO: CampoEditable = {
  // Libre: cualquier texto. Sólo no puede quedar vacío (la columna es NOT NULL).
  columna: 'codigo', etiqueta: 'Código', tipo: 'texto', minimo: 1,
}

const MODALIDAD: CampoEditable = {
  columna: 'modalidad', etiqueta: 'Modalidad', tipo: 'opcion',
  opciones: ['Virtual', 'Híbrida', 'Presencial'],
}

export const ENTIDADES: readonly Entidad[] = [
  // ---------- Jerarquía académica ----------
  {
    tabla: 'universidades',
    etiqueta: 'la universidad',
    nombre: 'universidad',
    campos: [
      CODIGO,
      { columna: 'universidad', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      MODALIDAD,
    ],
    roles: ['admin'],
    desactivable: true,
    alcance: 'universidad_id',
    dependientes: [
      { tabla: 'programas', columna: 'universidad_id', etiqueta: 'programas' },
      { tabla: 'cursos', columna: 'universidad_id', etiqueta: 'cursos' },
      { tabla: 'usuarios', columna: 'universidad_id', etiqueta: 'estudiantes' },
      { tabla: 'perfiles', columna: 'universidad_id', etiqueta: 'perfiles de acceso' },
      { tabla: 'perfiles_egreso', columna: 'universidad_id', etiqueta: 'perfiles de egreso' },
      { tabla: 'instituciones', columna: 'universidad_id', etiqueta: 'instituciones' },
    ],
  },
  {
    tabla: 'programas',
    etiqueta: 'el programa',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      MODALIDAD,
    ],
    roles: ['admin', 'coordinador'],
    desactivable: true,
    alcance: 'programa_id',
    dependientes: [
      { tabla: 'cursos', columna: 'programa_id', etiqueta: 'cursos' },
      { tabla: 'perfiles', columna: 'programa_id', etiqueta: 'perfiles de acceso' },
      { tabla: 'perfiles_egreso', columna: 'programa_id', etiqueta: 'perfiles de egreso' },
      { tabla: 'areas', columna: 'programa_id', etiqueta: 'áreas de formación' },
      { tabla: 'lineas_curriculares', columna: 'programa_id', etiqueta: 'líneas curriculares' },
      { tabla: 'resultados', columna: 'programa_id', etiqueta: 'resultados de aprendizaje' },
      { tabla: 'programas_macro', columna: 'programa_id', etiqueta: 'fichas macro' },
      { tabla: 'competencias', columna: 'programa_id', etiqueta: 'competencias propias' },
    ],
  },
  {
    tabla: 'cursos',
    etiqueta: 'el curso',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      { columna: 'semanas', etiqueta: 'Semanas', tipo: 'numero', minimo: 1, maximo: 52 },
      { columna: 'periodo', etiqueta: 'Periodo', tipo: 'texto', maximo: 30 },
    ],
    roles: ['admin', 'coordinador'],
    desactivable: true,
    alcance: 'curso_id',
    // Un curso con actividad registrada no se borra: dependen de él las
    // tablas de hechos que alimentan el motor. Se desactiva.
    dependientes: [
      { tabla: 'usuarios', columna: 'curso_id', etiqueta: 'estudiantes' },
      { tabla: 'grupos', columna: 'curso_id', etiqueta: 'grupos' },
      { tabla: 'actividades', columna: 'curso_id', etiqueta: 'actividades' },
      { tabla: 'evaluaciones', columna: 'curso_id', etiqueta: 'evaluaciones' },
      { tabla: 'foros', columna: 'curso_id', etiqueta: 'registros de foro' },
      { tabla: 'colaboracion', columna: 'curso_id', etiqueta: 'registros de colaboración' },
      { tabla: 'moodle_logs', columna: 'curso_id', etiqueta: 'registros de plataforma' },
      { tabla: 'rubrica', columna: 'curso_id', etiqueta: 'calificaciones de rúbrica' },
      { tabla: 'evidencias', columna: 'curso_id', etiqueta: 'evidencias' },
      { tabla: 'intervenciones', columna: 'curso_id', etiqueta: 'intervenciones' },
      { tabla: 'recomendaciones_ia', columna: 'curso_id', etiqueta: 'recomendaciones' },
      { tabla: 'perfiles', columna: 'curso_id', etiqueta: 'perfiles de acceso' },
      { tabla: 'unidades', columna: 'curso_id', etiqueta: 'unidades' },
      { tabla: 'resultados', columna: 'curso_id', etiqueta: 'resultados de aprendizaje' },
    ],
  },
  {
    tabla: 'grupos',
    etiqueta: 'el grupo',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 2, maximo: 80 },
      { columna: 'periodo', etiqueta: 'Periodo', tipo: 'texto', maximo: 30 },
    ],
    roles: ['admin', 'coordinador'],
    desactivable: true,
    alcance: 'curso_id',
    dependientes: [
      { tabla: 'usuarios', columna: 'grupo_id', etiqueta: 'estudiantes' },
      { tabla: 'perfiles', columna: 'grupo_id', etiqueta: 'perfiles de acceso' },
      { tabla: 'evidencias', columna: 'grupo_id', etiqueta: 'evidencias' },
      { tabla: 'intervenciones', columna: 'grupo_id', etiqueta: 'intervenciones' },
    ],
  },

  // ---------- Modelo curricular ----------
  {
    tabla: 'instituciones',
    etiqueta: 'la institución',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 160 },
      { columna: 'siglas', etiqueta: 'Siglas', tipo: 'texto', maximo: 20 },
      { columna: 'pais', etiqueta: 'País', tipo: 'texto', maximo: 60 },
    ],
    roles: ['admin'],
    desactivable: true,
    dependientes: [
      { tabla: 'facultades', columna: 'institucion_id', etiqueta: 'facultades' },
    ],
  },
  {
    tabla: 'facultades',
    etiqueta: 'la facultad',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 160 },
    ],
    roles: ['admin'],
    desactivable: true,
    dependientes: [
      { tabla: 'programas_macro', columna: 'facultad_id', etiqueta: 'programas' },
    ],
  },
  {
    tabla: 'areas',
    etiqueta: 'el área',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      { columna: 'tipo', etiqueta: 'Tipo', tipo: 'opcion', opciones: ['Área', 'Componente'] },
      { columna: 'descripcion', etiqueta: 'Descripción', tipo: 'largo', maximo: 2000 },
    ],
    roles: ['admin', 'coordinador'],
    desactivable: true,
    alcance: 'programa_id',
    dependientes: [
      { tabla: 'cursos_meso', columna: 'area_id', etiqueta: 'asignaturas ubicadas' },
      { tabla: 'resultados', columna: 'area_id', etiqueta: 'resultados de aprendizaje' },
      { tabla: 'area_competencias', columna: 'area_id', etiqueta: 'competencias vinculadas' },
    ],
  },
  {
    tabla: 'lineas_curriculares',
    etiqueta: 'la línea curricular',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      { columna: 'descripcion', etiqueta: 'Descripción', tipo: 'largo', maximo: 2000 },
    ],
    roles: ['admin', 'coordinador'],
    desactivable: true,
    alcance: 'programa_id',
    dependientes: [
      { tabla: 'cursos_meso', columna: 'linea_id', etiqueta: 'asignaturas ubicadas' },
    ],
  },
  {
    tabla: 'unidades',
    etiqueta: 'la unidad',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 160 },
      { columna: 'descripcion', etiqueta: 'Descripción', tipo: 'largo', maximo: 2000 },
      { columna: 'semana_inicio', etiqueta: 'Semana inicial', tipo: 'numero', minimo: 1, maximo: 52 },
      { columna: 'semana_fin', etiqueta: 'Semana final', tipo: 'numero', minimo: 1, maximo: 52 },
    ],
    roles: ['admin', 'coordinador', 'docente'],
    desactivable: true,
    alcance: 'curso_id',
    dependientes: [],
  },
  {
    tabla: 'resultados',
    etiqueta: 'el resultado de aprendizaje',
    nombre: 'codigo',
    campos: [
      CODIGO,
      { columna: 'enunciado', etiqueta: 'Enunciado', tipo: 'largo', minimo: 15, maximo: 2000 },
    ],
    roles: ['admin', 'coordinador', 'docente'],
    desactivable: true,
    alcance: 'por_ambito',
    dependientes: [
      { tabla: 'resultado_indicadores', columna: 'resultado_id', etiqueta: 'indicadores enlazados' },
      { tabla: 'evidencias', columna: 'resultado_id', etiqueta: 'evidencias' },
      { tabla: 'recomendaciones_ia', columna: 'resultado_id', etiqueta: 'recomendaciones' },
    ],
  },

  // ---------- Competencias ----------
  {
    tabla: 'competencias',
    etiqueta: 'la competencia',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      { columna: 'descripcion', etiqueta: 'Descripción', tipo: 'largo', maximo: 2000 },
      { columna: 'student_outcome', etiqueta: 'Student Outcome ABET', tipo: 'texto', maximo: 10 },
    ],
    roles: ['admin'],
    desactivable: true,
    dependientes: [
      { tabla: 'dimensiones', columna: 'competencia_id', etiqueta: 'dimensiones' },
      { tabla: 'resultados', columna: 'competencia_id', etiqueta: 'resultados de aprendizaje' },
      { tabla: 'recomendaciones_ia', columna: 'competencia_id', etiqueta: 'recomendaciones' },
    ],
  },
  {
    tabla: 'dimensiones',
    etiqueta: 'la dimensión',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      { columna: 'descripcion', etiqueta: 'Qué se observa', tipo: 'largo', maximo: 2000 },
    ],
    roles: ['admin'],
    desactivable: true,
    dependientes: [
      { tabla: 'indicadores', columna: 'dimension_id', etiqueta: 'indicadores' },
      { tabla: 'intervenciones', columna: 'dimension_id', etiqueta: 'intervenciones' },
      { tabla: 'recomendaciones_ia', columna: 'dimension_id', etiqueta: 'recomendaciones' },
    ],
  },
  {
    tabla: 'indicadores',
    etiqueta: 'el indicador',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 3, maximo: 120 },
      { columna: 'descripcion', etiqueta: 'Descripción', tipo: 'largo', maximo: 2000 },
      { columna: 'valor_esperado', etiqueta: 'Valor esperado', tipo: 'numero', minimo: 0 },
      { columna: 'umbral', etiqueta: 'Umbral', tipo: 'numero', minimo: 0 },
    ],
    roles: ['admin'],
    desactivable: true,
    // La agregación no se edita a propósito: cambiarla con evidencias ya
    // cargadas reinterpretaría todos los valores existentes.
    dependientes: [
      { tabla: 'evidencias', columna: 'indicador_id', etiqueta: 'evidencias' },
      { tabla: 'mapeos', columna: 'indicador_id', etiqueta: 'mapeos' },
      { tabla: 'resultado_indicadores', columna: 'indicador_id', etiqueta: 'resultados enlazados' },
      { tabla: 'intervenciones', columna: 'indicador_id', etiqueta: 'intervenciones' },
    ],
  },

  // ---------- Fuentes ----------
  {
    tabla: 'fuentes_datos',
    etiqueta: 'la fuente de datos',
    nombre: 'nombre',
    campos: [
      CODIGO,
      { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto', minimo: 2, maximo: 120 },
      { columna: 'descripcion', etiqueta: 'Descripción', tipo: 'largo', maximo: 2000 },
      {
        columna: 'modo_ingreso', etiqueta: 'Modo de ingreso', tipo: 'opcion',
        opciones: ['API', 'Carga', 'Manual'],
      },
    ],
    roles: ['admin'],
    desactivable: true,
    dependientes: [
      { tabla: 'evidencias', columna: 'fuente_id', etiqueta: 'evidencias' },
      { tabla: 'mapeos', columna: 'fuente_id', etiqueta: 'mapeos' },
      { tabla: 'lotes_carga', columna: 'fuente_id', etiqueta: 'cargas' },
    ],
  },
]

const POR_TABLA = new Map(ENTIDADES.map((e) => [e.tabla, e]))

/** La entidad, o `undefined` si la tabla no está en la lista blanca. */
export function entidadDe(tabla: string): Entidad | undefined {
  return POR_TABLA.get(tabla)
}

/**
 * Valida y normaliza un valor según la definición del campo.
 *
 * Devuelve el valor listo para guardar, o un mensaje de error. Un campo
 * vacío se guarda como `null`, salvo que tenga mínimo: entonces es error,
 * porque vaciar el nombre de algo lo dejaría sin forma de identificarlo.
 */
export function validarCampo(
  campo: CampoEditable,
  crudo: string
): { valor: string | number | null } | { error: string } {
  const texto = crudo.trim()

  if (texto === '') {
    if (campo.minimo !== undefined && campo.tipo !== 'numero') {
      return { error: `${campo.etiqueta} no puede quedar vacío.` }
    }
    return { valor: null }
  }

  switch (campo.tipo) {
    case 'numero': {
      const n = Number(texto)
      if (!Number.isFinite(n)) return { error: `${campo.etiqueta} debe ser un número.` }
      if (campo.minimo !== undefined && n < campo.minimo) {
        return { error: `${campo.etiqueta} no puede ser menor que ${campo.minimo}.` }
      }
      if (campo.maximo !== undefined && n > campo.maximo) {
        return { error: `${campo.etiqueta} no puede ser mayor que ${campo.maximo}.` }
      }
      return { valor: n }
    }

    case 'opcion':
      if (!campo.opciones?.includes(texto)) {
        return { error: `${campo.etiqueta}: valor no admitido.` }
      }
      return { valor: texto }

    case 'texto':
    case 'largo': {
      if (campo.minimo !== undefined && texto.length < campo.minimo) {
        return { error: `${campo.etiqueta} necesita al menos ${campo.minimo} caracteres.` }
      }
      if (campo.maximo !== undefined && texto.length > campo.maximo) {
        return { error: `${campo.etiqueta} supera los ${campo.maximo} caracteres.` }
      }
      return { valor: texto }
    }
  }
}

/** Frase legible con lo que impide borrar: «12 estudiantes y 3 cursos». */
export function describirDependientes(
  conteos: { etiqueta: string; cuantos: number }[]
): string {
  const partes = conteos
    .filter((c) => c.cuantos > 0)
    .map((c) => `${c.cuantos} ${c.etiqueta}`)

  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/**
 * Campos del editor para una fila concreta, con sus valores actuales.
 *
 * Es lo que las páginas pasan a `EditorEntidad`. Devuelve lista vacía si
 * la tabla no está en la lista blanca, para que la página no muestre un
 * editor que luego el servidor rechazaría.
 */
export function camposParaEditor(
  tabla: string,
  fila: Record<string, unknown>
): { columna: string; etiqueta: string; tipo: TipoCampo; valor: string; opciones?: readonly string[] }[] {
  const entidad = entidadDe(tabla)
  if (!entidad) return []

  return entidad.campos.map((c) => ({
    columna: c.columna,
    etiqueta: c.etiqueta,
    tipo: c.tipo,
    valor: fila[c.columna] == null ? '' : String(fila[c.columna]),
    opciones: c.opciones,
  }))
}
