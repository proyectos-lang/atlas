import { describe, expect, it } from 'vitest'
import {
  alcanceDe, alcanceVacio, aplicarFiltros, puedeVer, restringir,
  INICIO_POR_ROL, type Perfil, type Rol,
} from '@/lib/auth/alcance'

const base: Omit<Perfil, 'rol' | 'universidadId' | 'cursoId' | 'usuarioId'> = {
  id: 1, authUserId: 'u', nombre: 'X', email: 'x@y.z', activo: true, modulos: null,
  programaId: null, grupoId: null,
}

const perfil = (
  rol: Rol,
  ambito: Partial<Pick<Perfil, 'universidadId' | 'cursoId' | 'usuarioId'>> = {}
): Perfil => ({
  ...base, rol,
  universidadId: ambito.universidadId ?? null,
  cursoId: ambito.cursoId ?? null,
  usuarioId: ambito.usuarioId ?? null,
})

describe('alcance por rol', () => {
  it('admin no tiene restricción en ninguna dimensión', () => {
    const a = alcanceDe(perfil('admin'))
    expect(a.universidadIds).toBeNull()
    expect(a.cursoIds).toBeNull()
    expect(a.usuarioIds).toBeNull()
    expect(alcanceVacio(a)).toBe(false)
  })

  it('coordinador queda ceñido a su universidad', () => {
    const a = alcanceDe(perfil('coordinador', { universidadId: 7 }))
    expect(a.universidadIds).toEqual([7])
    expect(a.cursoIds).toBeNull()
  })

  it('asesor queda ceñido a su universidad', () => {
    const a = alcanceDe(perfil('asesor', { universidadId: 3 }))
    expect(a.universidadIds).toEqual([3])
  })

  it('docente queda ceñido a su curso', () => {
    const a = alcanceDe(perfil('docente', { universidadId: 1, cursoId: 42 }))
    expect(a.cursoIds).toEqual([42])
  })

  it('estudiante queda ceñido a sí mismo', () => {
    const a = alcanceDe(perfil('estudiante', { universidadId: 1, cursoId: 2, usuarioId: 99 }))
    expect(a.usuarioIds).toEqual([99])
  })
})

describe('configuración incompleta niega el acceso, no lo abre', () => {
  // Es la propiedad de seguridad clave: ante un ámbito faltante el alcance
  // queda vacío (no ve nada), nunca nulo (vería todo).
  it.each([
    ['coordinador', {}],
    ['asesor', {}],
    ['docente', { universidadId: 1 }],
    ['estudiante', { universidadId: 1, cursoId: 2 }],
  ] as const)('%s sin su ámbito produce alcance vacío', (rol, ambito) => {
    const a = alcanceDe(perfil(rol as Rol, ambito))
    expect(alcanceVacio(a)).toBe(true)
  })
})

describe('los filtros de la interfaz no amplían el alcance', () => {
  it('un docente que pide otro curso no lo obtiene', () => {
    const a = alcanceDe(perfil('docente', { cursoId: 10 }))
    const conFiltro = aplicarFiltros(a, { cursoIds: [11, 12] })
    expect(conFiltro.cursoIds).toEqual([])   // intersección vacía
  })

  it('un docente que pide su propio curso sí lo obtiene', () => {
    const a = alcanceDe(perfil('docente', { cursoId: 10 }))
    expect(aplicarFiltros(a, { cursoIds: [10] }).cursoIds).toEqual([10])
  })

  it('el admin sí puede acotar con filtros', () => {
    const a = alcanceDe(perfil('admin'))
    expect(aplicarFiltros(a, { cursoIds: [5] }).cursoIds).toEqual([5])
  })

  it('restringir mantiene el permiso cuando no se pide nada', () => {
    expect(restringir([1, 2], null)).toEqual([1, 2])
    expect(restringir([1, 2], [])).toEqual([1, 2])
    expect(restringir(null, [9])).toEqual([9])
    expect(restringir([1, 2], [2, 3])).toEqual([2])
  })
})

describe('rutas por rol', () => {
  it('cada rol entra a su propia página', () => {
    for (const rol of ['admin', 'coordinador', 'asesor', 'docente', 'estudiante'] as Rol[]) {
      expect(puedeVer(rol, INICIO_POR_ROL[rol])).toBe(true)
    }
  })

  it('un estudiante no entra a las páginas de gestión', () => {
    for (const r of ['/administrador', '/coordinador', '/asesor', '/docente', '/admin/perfiles']) {
      expect(puedeVer('estudiante', r)).toBe(false)
    }
  })

  it('un docente no entra a administración ni al panel institucional', () => {
    expect(puedeVer('docente', '/admin/perfiles')).toBe(false)
    expect(puedeVer('docente', '/administrador')).toBe(false)
  })

  it('sólo el admin entra a /admin', () => {
    expect(puedeVer('admin', '/admin/perfiles')).toBe(true)
    for (const rol of ['coordinador', 'asesor', 'docente', 'estudiante'] as Rol[]) {
      expect(puedeVer(rol, '/admin/perfiles')).toBe(false)
    }
  })

  it('las subrutas heredan el permiso de su raíz', () => {
    expect(puedeVer('docente', '/docente/curso/1')).toBe(true)
    expect(puedeVer('estudiante', '/estudiante/detalle')).toBe(true)
  })
})
