import { RUTAS_POR_ROL, type Rol } from './alcance'

/**
 * Navegación lateral, agrupada por tipo de tarea.
 *
 * El control de acceso NO vive aquí: sigue siendo `RUTAS_POR_ROL`. Este
 * módulo sólo decide cómo se presentan las rutas que el rol ya puede ver,
 * y filtra contra esa lista para que añadir un ítem aquí no conceda acceso
 * a nada por sí solo.
 */

export type IconoNav =
  | 'tablero' | 'institucion' | 'programa' | 'aula' | 'persona'
  | 'analisis' | 'ia' | 'revision' | 'ajustes' | 'ayuda' | 'galeria'

export interface ItemNav {
  ruta: string
  etiqueta: string
  /** Frase corta bajo la etiqueta. No se repite el nombre. */
  pie?: string
  icono: IconoNav
}

export interface GrupoNav {
  titulo: string
  items: ItemNav[]
}

/** Catálogo de rutas. El orden dentro de cada grupo es el orden en pantalla. */
const GRUPOS: readonly { titulo: string; items: readonly ItemNav[] }[] = [
  {
    titulo: 'Tableros',
    items: [
      { ruta: '/inicio', etiqueta: 'Inicio', pie: 'Resumen y accesos', icono: 'tablero' },
      { ruta: '/administrador', etiqueta: 'Institucional', pie: 'Todas las universidades', icono: 'institucion' },
      { ruta: '/coordinador', etiqueta: 'Coordinación', pie: 'Programa académico', icono: 'programa' },
      { ruta: '/docente', etiqueta: 'Docencia', pie: 'Curso a cargo', icono: 'aula' },
      { ruta: '/estudiante', etiqueta: 'Estudiante', pie: 'Seguimiento individual', icono: 'persona' },
      { ruta: '/asesor', etiqueta: 'Asesoría pedagógica', pie: 'Intervención y apoyo', icono: 'tablero' },
    ],
  },
  {
    titulo: 'Análisis e IA',
    items: [
      { ruta: '/analisis', etiqueta: 'Catálogo de indicadores', pie: 'Qué mide cada uno', icono: 'analisis' },
      { ruta: '/recomendador', etiqueta: 'Recomendaciones', pie: 'Generadas por el agente', icono: 'ia' },
      { ruta: '/docente/revision', etiqueta: 'Revisión docente', pie: 'Aprobar o rechazar', icono: 'revision' },
    ],
  },
  {
    titulo: 'Configuración',
    items: [
      { ruta: '/admin', etiqueta: 'Administración', pie: 'Perfiles y perfil de egreso', icono: 'ajustes' },
      { ruta: '/componentes', etiqueta: 'Galería de componentes', pie: 'Referencia visual', icono: 'galeria' },
      { ruta: '/acerca-de', etiqueta: 'Acerca de los indicadores', pie: 'Cómo se calcula cada cifra', icono: 'ayuda' },
    ],
  },
]

/**
 * Grupos visibles para un rol, ya filtrados y sin grupos vacíos.
 *
 * Una ruta que el rol no tenga en `RUTAS_POR_ROL` no aparece, aunque figure
 * en el catálogo de arriba.
 */
export function navegacionDe(rol: Rol): GrupoNav[] {
  const permitidas = new Set(RUTAS_POR_ROL[rol])

  return GRUPOS.map((g) => ({
    titulo: g.titulo,
    items: g.items.filter((i) => permitidas.has(i.ruta)),
  })).filter((g) => g.items.length > 0)
}

/**
 * Rutas que el rol puede ver pero que ningún grupo recoge. Sin esto, añadir
 * una ruta a RUTAS_POR_ROL y olvidarla aquí la haría desaparecer del menú
 * sin que nada avise.
 */
export function rutasHuerfanas(rol: Rol): string[] {
  const enGrupos = new Set(GRUPOS.flatMap((g) => g.items.map((i) => i.ruta)))
  return RUTAS_POR_ROL[rol].filter((r) => !enGrupos.has(r))
}
