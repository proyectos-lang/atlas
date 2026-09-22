import { RUTAS_POR_ROL, modulosDe, type Perfil, type Rol } from './alcance'

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
      { ruta: '/analitica', etiqueta: 'Analítica', pie: 'Dificultades y riesgo', icono: 'analisis' },
      { ruta: '/analisis', etiqueta: 'Catálogo de indicadores', pie: 'Qué mide cada uno', icono: 'analisis' },
      { ruta: '/recomendador', etiqueta: 'Recomendaciones', pie: 'Generadas por el agente', icono: 'ia' },
      { ruta: '/intervenciones', etiqueta: 'Intervenciones', pie: 'Qué se hizo y qué cambió', icono: 'revision' },
      { ruta: '/docente/revision', etiqueta: 'Revisión docente', pie: 'Aprobar o rechazar', icono: 'revision' },
    ],
  },
  {
    // Las secciones de configuración van una a una, no tras un enlace
    // genérico a /admin: escondidas detrás de «Administración» nadie las
    // encontraba, porque la sub-navegación sólo aparece una vez dentro.
    titulo: 'Configuración',
    items: [
      { ruta: '/admin/curriculo', etiqueta: 'Modelo curricular', pie: 'Macro, meso, micro y resultados', icono: 'programa' },
      { ruta: '/admin/competencias', etiqueta: 'Competencias', pie: 'Dimensiones e indicadores', icono: 'analisis' },
      { ruta: '/admin/fuentes', etiqueta: 'Fuentes de datos', pie: 'De dónde vienen las evidencias', icono: 'ajustes' },
      { ruta: '/admin/jerarquia', etiqueta: 'Jerarquía académica', pie: 'Programas, cursos y grupos', icono: 'institucion' },
      { ruta: '/admin/perfil-egreso', etiqueta: 'Perfil de egreso', pie: 'Contexto para el análisis de IA', icono: 'ayuda' },
      { ruta: '/admin/perfiles', etiqueta: 'Perfiles de acceso', pie: 'Quién entra y qué ve', icono: 'persona' },
    ],
  },
  {
    titulo: 'Referencia',
    items: [
      { ruta: '/acerca-de', etiqueta: 'Acerca de los indicadores', pie: 'Cómo se calcula cada cifra', icono: 'ayuda' },
      { ruta: '/componentes', etiqueta: 'Galería de componentes', pie: 'Referencia visual', icono: 'galeria' },
    ],
  },
]

/**
 * Grupos visibles para un rol, ya filtrados y sin grupos vacíos.
 *
 * Una ruta que el rol no tenga en `RUTAS_POR_ROL` no aparece, aunque figure
 * en el catálogo de arriba.
 */
export function navegacionDe(
  perfilORol: Pick<Perfil, 'rol' | 'modulos'> | Rol
): GrupoNav[] {
  // Acepta el rol suelto para las pruebas y los sitios donde no hay perfil;
  // cuando lo hay, manda lo que el administrador configuró.
  const permitidas =
    typeof perfilORol === 'string'
      ? RUTAS_POR_ROL[perfilORol]
      : modulosDe(perfilORol)

  // Una ruta concedida habilita sus subrutas, igual que en `puedeVer`.
  // Comparar por igualdad exacta escondía el grupo de Configuración
  // entero: el administrador tiene `/admin`, no `/admin/curriculo`.
  const visible = (ruta: string) =>
    permitidas.some((p) => ruta === p || ruta.startsWith(`${p}/`))

  return GRUPOS.map((g) => ({
    titulo: g.titulo,
    items: g.items.filter((i) => visible(i.ruta)),
  })).filter((g) => g.items.length > 0)
}

/** Catálogo completo de módulos, para la pantalla de permisos. */
export function catalogoModulos(): { titulo: string; items: ItemNav[] }[] {
  return GRUPOS.map((g) => ({ titulo: g.titulo, items: [...g.items] }))
}

/** Etiqueta legible de una ruta. Si no está en el catálogo, la propia ruta. */
export function etiquetaModulo(ruta: string): string {
  for (const g of GRUPOS) {
    const i = g.items.find((x) => x.ruta === ruta)
    if (i) return i.etiqueta
  }
  return ruta
}

/**
 * Rutas que existen para dar acceso, pero que no son destino propio: sólo
 * redirigen a una de sus subrutas. No aparecen en el menú porque no hay
 * nada que mostrar en ellas.
 *
 * `/admin` concede acceso a todas las secciones de configuración, que sí
 * tienen su ítem cada una.
 */
const RUTAS_PUENTE = new Set(['/admin'])

/**
 * Rutas que el rol puede ver pero que ningún grupo recoge. Sin esto, añadir
 * una ruta a RUTAS_POR_ROL y olvidarla aquí la haría desaparecer del menú
 * sin que nada avise.
 */
export function rutasHuerfanas(rol: Rol): string[] {
  const enGrupos = new Set(GRUPOS.flatMap((g) => g.items.map((i) => i.ruta)))
  return RUTAS_POR_ROL[rol].filter(
    (r) => !enGrupos.has(r) && !RUTAS_PUENTE.has(r)
  )
}
