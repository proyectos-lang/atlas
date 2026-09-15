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
  cursoId: number | null
  usuarioId: number | null
  activo: boolean
}

/**
 * Conjuntos de ids visibles. `null` significa "sin restricción en esta
 * dimensión"; una lista vacía significa "no ve nada" y debe producir
 * resultados vacíos, nunca ausencia de filtro.
 */
export interface Alcance {
  rol: Rol
  universidadIds: number[] | null
  cursoIds: number[] | null
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
  admin: ['/inicio', '/administrador', '/coordinador', '/asesor', '/docente', '/estudiante', '/analisis', '/admin', '/componentes', '/recomendador', '/acerca-de'],
  coordinador: ['/inicio', '/coordinador', '/asesor', '/docente', '/estudiante', '/analisis', '/recomendador', '/acerca-de'],
  asesor: ['/inicio', '/asesor', '/analisis', '/recomendador', '/acerca-de'],
  docente: ['/inicio', '/docente', '/analisis', '/acerca-de'],
  estudiante: ['/inicio', '/estudiante', '/acerca-de'],
}

export function puedeVer(rol: Rol, ruta: string): boolean {
  return RUTAS_POR_ROL[rol].some((r) => ruta === r || ruta.startsWith(`${r}/`))
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
      return { ...base, universidadIds: null, cursoIds: null, usuarioIds: null }

    case 'coordinador':
    case 'asesor':
      return {
        ...base,
        universidadIds: perfil.universidadId !== null ? [perfil.universidadId] : [],
        cursoIds: null,
        usuarioIds: null,
      }

    case 'docente':
      return {
        ...base,
        universidadIds: perfil.universidadId !== null ? [perfil.universidadId] : null,
        cursoIds: perfil.cursoId !== null ? [perfil.cursoId] : [],
        usuarioIds: null,
      }

    case 'estudiante':
      return {
        ...base,
        universidadIds: perfil.universidadId !== null ? [perfil.universidadId] : null,
        cursoIds: perfil.cursoId !== null ? [perfil.cursoId] : null,
        usuarioIds: perfil.usuarioId !== null ? [perfil.usuarioId] : [],
      }
  }
}

/** ¿El alcance no puede devolver ninguna fila? */
export function alcanceVacio(a: Alcance): boolean {
  return (
    a.universidadIds?.length === 0 ||
    a.cursoIds?.length === 0 ||
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
    cursoIds?: number[] | null
    usuarioIds?: number[] | null
  }
): Alcance {
  return {
    ...alcance,
    universidadIds: restringir(alcance.universidadIds, filtros.universidadIds ?? null),
    cursoIds: restringir(alcance.cursoIds, filtros.cursoIds ?? null),
    usuarioIds: restringir(alcance.usuarioIds, filtros.usuarioIds ?? null),
  }
}
