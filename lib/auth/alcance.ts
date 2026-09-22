/**
 * Alcance de datos por perfil.
 *
 * Toda consulta de negocio recibe un Alcance y lo aplica como filtro en el
 * servidor. No existe forma de pedir datos fuera del alcance: las funciones
 * de acceso a datos no aceptan consultas sin él (ver lib/kpi/consultas.ts).
 *
 * RLS está deshabilitado a propósito; este módulo es el control de acceso.
 */

export type Rol = 'admin' | 'coordinador' | 'asesor' | 'docente' | 'estudiante'

export interface Perfil {
  id: number
  authUserId: string
  nombre: string
  email: string
  rol: Rol
  universidadId: number | null
  programaId: number | null
  cursoId: number | null
  grupoId: number | null
  usuarioId: number | null
  activo: boolean
  /**
   * Módulos concedidos a este perfil concreto. `null` = sin personalizar,
   * usa los de su rol. Array vacío = ningún módulo (no es lo mismo).
   */
  modulos: string[] | null
}

/**
 * Conjuntos de ids visibles. `null` significa "sin restricción en esta
 * dimensión"; una lista vacía significa "no ve nada" y debe producir
 * resultados vacíos, nunca ausencia de filtro.
 */
export interface Alcance {
  rol: Rol
  universidadIds: number[] | null
  programaIds: number[] | null
  cursoIds: number[] | null
  grupoIds: number[] | null
  usuarioIds: number[] | null
  /** El perfil que originó el alcance, para trazabilidad. */
  perfilId: number
}

/** Página inicial de cada rol. Una ruta fuera del rol redirige aquí. */
export const INICIO_POR_ROL: Record<Rol, string> = {
  admin: '/administrador',
  coordinador: '/coordinador',
  asesor: '/asesor',
  docente: '/docente',
  estudiante: '/estudiante',
}

/** Rutas que cada rol puede visitar. */
export const RUTAS_POR_ROL: Record<Rol, readonly string[]> = {
  admin: ['/inicio', '/analitica', '/administrador', '/coordinador', '/asesor', '/docente', '/estudiante', '/analisis', '/admin', '/componentes', '/recomendador', '/acerca-de'],
  coordinador: ['/inicio', '/analitica', '/coordinador', '/asesor', '/docente', '/estudiante', '/analisis', '/recomendador', '/acerca-de'],
  asesor: ['/inicio', '/analitica', '/asesor', '/analisis', '/recomendador', '/acerca-de'],
  docente: ['/inicio', '/analitica', '/docente', '/analisis', '/acerca-de'],
  estudiante: ['/inicio', '/estudiante', '/acerca-de'],
}

/**
 * ¿Este conjunto de rutas cubre la ruta pedida?
 *
 * Una ruta cubre sus subrutas: `/admin` habilita `/admin/perfiles`. Por eso
 * conceder un módulo concede también lo que cuelga de él.
 */
function cubre(rutas: readonly string[], ruta: string): boolean {
  return rutas.some((r) => ruta === r || ruta.startsWith(`${r}/`))
}

/**
 * Acceso por rol, sin considerar permisos por perfil.
 *
 * Se mantiene para los sitios donde sólo se conoce el rol. Cuando exista el
 * perfil, usar `perfilPuedeVer`: es lo que respeta lo que el administrador
 * configuró.
 */
export function puedeVer(rol: Rol, ruta: string): boolean {
  return cubre(RUTAS_POR_ROL[rol], ruta)
}

/**
 * Módulos efectivos de un perfil.
 *
 * El rol da el valor de partida y el administrador lo ajusta. `null` en
 * `modulos` significa "sin personalizar", NO "sin módulos": distinguirlo del
 * array vacío es lo que permite que los perfiles creados antes de esta
 * función sigan comportándose igual que siempre.
 */
export function modulosDe(perfil: Pick<Perfil, 'rol' | 'modulos'>): readonly string[] {
  return perfil.modulos ?? RUTAS_POR_ROL[perfil.rol]
}

/**
 * ¿Este perfil puede ver esta ruta?
 *
 * Es el control de acceso de navegación. Sólo decide QUÉ PANTALLAS se ven:
 * qué datos aparecen en ellas lo sigue decidiendo el Alcance, que no se
 * toca aquí. Conceder `/administrador` a un docente le muestra el tablero
 * institucional con los datos de su curso, no con los de la universidad.
 */
export function perfilPuedeVer(
  perfil: Pick<Perfil, 'rol' | 'modulos'>,
  ruta: string
): boolean {
  return cubre(modulosDe(perfil), ruta)
}

/**
 * Primera pantalla del perfil al entrar.
 *
 * `INICIO_POR_ROL` puede haber quedado fuera de sus módulos, y mandar a
 * alguien a una página que no puede ver produciría un bucle de redirección.
 */
export function inicioDe(perfil: Pick<Perfil, 'rol' | 'modulos'>): string | null {
  const modulos = modulosDe(perfil)
  if (cubre(modulos, '/inicio')) return '/inicio'
  if (cubre(modulos, INICIO_POR_ROL[perfil.rol])) return INICIO_POR_ROL[perfil.rol]
  return modulos[0] ?? null
}

/**
 * Deriva el alcance del perfil.
 *
 * · admin        todas las universidades, cursos y estudiantes
 * · coordinador  solo su universidad
 * · asesor       solo su universidad
 * · docente      solo su curso
 * · estudiante   solo sus propios datos
 *
 * Si a un perfil restringido le falta su id de ámbito, el alcance queda
 * vacío (lista vacía), no abierto. Es deliberado: ante configuración
 * incompleta se niega el acceso en vez de exponer datos de más.
 */
export function alcanceDe(perfil: Perfil): Alcance {
  const base = { rol: perfil.rol, perfilId: perfil.id }

  switch (perfil.rol) {
    case 'admin':
      return {
        ...base,
        universidadIds: null, programaIds: null,
        cursoIds: null, grupoIds: null, usuarioIds: null,
      }

    case 'coordinador':
    case 'asesor':
      // ESCALADA DE PRIVILEGIOS A EVITAR: antes de la jerarquía, el
      // `universidad_id` de estos perfiles apuntaba a una fila que en
      // realidad ERA un programa. Mientras cada universidad tenga un solo
      // programa da igual, pero en cuanto una tenga dos, ceñir sólo por
      // universidad les mostraría el programa ajeno.
      //
      // Por eso, con programa asignado se ciñe POR PROGRAMA y se suelta la
      // universidad: el programa ya la determina, y dejar ambos filtros
      // activos no añade seguridad pero sí rompe cuando un programa se
      // reasigna de institución.
      return perfil.programaId !== null
        ? {
            ...base,
            universidadIds: null,
            programaIds: [perfil.programaId],
            cursoIds: null,
            grupoIds: null,
            usuarioIds: null,
          }
        : {
            ...base,
            universidadIds: perfil.universidadId !== null ? [perfil.universidadId] : [],
            programaIds: null,
            cursoIds: null,
            grupoIds: null,
            usuarioIds: null,
          }

    case 'docente':
      // Un docente con grupo asignado ve solo ese grupo, no el curso entero:
      // es lo que permite que dos docentes compartan curso sin verse.
      return {
        ...base,
        universidadIds: perfil.universidadId !== null ? [perfil.universidadId] : null,
        programaIds: perfil.programaId !== null ? [perfil.programaId] : null,
        cursoIds: perfil.cursoId !== null ? [perfil.cursoId] : [],
        grupoIds: perfil.grupoId !== null ? [perfil.grupoId] : null,
        usuarioIds: null,
      }

    case 'estudiante':
      return {
        ...base,
        universidadIds: perfil.universidadId !== null ? [perfil.universidadId] : null,
        programaIds: perfil.programaId !== null ? [perfil.programaId] : null,
        cursoIds: perfil.cursoId !== null ? [perfil.cursoId] : null,
        grupoIds: perfil.grupoId !== null ? [perfil.grupoId] : null,
        usuarioIds: perfil.usuarioId !== null ? [perfil.usuarioId] : [],
      }
  }
}

/** ¿El alcance no puede devolver ninguna fila? */
export function alcanceVacio(a: Alcance): boolean {
  return (
    a.universidadIds?.length === 0 ||
    a.programaIds?.length === 0 ||
    a.cursoIds?.length === 0 ||
    a.grupoIds?.length === 0 ||
    a.usuarioIds?.length === 0
  )
}

/**
 * Intersecta el alcance con una selección de filtros de la interfaz.
 * Lo pedido nunca puede ampliar lo permitido: si el usuario fuerza un
 * curso ajeno en la URL, la intersección lo deja fuera.
 */
export function restringir(
  permitido: number[] | null,
  pedido: number[] | null
): number[] | null {
  if (pedido === null || pedido.length === 0) return permitido
  if (permitido === null) return pedido
  return pedido.filter((id) => permitido.includes(id))
}

export function aplicarFiltros(
  alcance: Alcance,
  filtros: {
    universidadIds?: number[] | null
    programaIds?: number[] | null
    cursoIds?: number[] | null
    grupoIds?: number[] | null
    usuarioIds?: number[] | null
  }
): Alcance {
  return {
    ...alcance,
    universidadIds: restringir(alcance.universidadIds, filtros.universidadIds ?? null),
    programaIds: restringir(alcance.programaIds, filtros.programaIds ?? null),
    cursoIds: restringir(alcance.cursoIds, filtros.cursoIds ?? null),
    grupoIds: restringir(alcance.grupoIds, filtros.grupoIds ?? null),
    usuarioIds: restringir(alcance.usuarioIds, filtros.usuarioIds ?? null),
  }
}
