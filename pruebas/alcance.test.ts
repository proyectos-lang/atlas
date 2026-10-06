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

describe('el docente obtiene su acceso de los grupos que se le asignan', () => {
  // Antes el acceso salía sólo del curso fijado en el perfil: un docente
  // creado sin curso no veía nada aunque tuviera grupos, y uno con grupos
  // en dos cursos no se podía representar.
  const g = (grupoId: number, cursoId: number, programaId = 5, universidadId = 1) =>
    ({ grupoId, cursoId, programaId, universidadId })

  const docente = (extra: Partial<Perfil>): Perfil => ({ ...perfil('docente'), ...extra })

  it('sin curso ni grupos asignados no ve nada', () => {
    expect(alcanceVacio(alcanceDe(docente({ gruposAsignados: [] })))).toBe(true)
  })

  it('con un grupo asignado ve sólo ese grupo y su curso', () => {
    const a = alcanceDe(docente({ gruposAsignados: [g(7, 3)] }))
    expect(a.cursoIds).toEqual([3])
    expect(a.grupoIds).toEqual([7])
    expect(alcanceVacio(a)).toBe(false)
  })

  it('con grupos en dos cursos ve ambos, y sólo esos grupos', () => {
    const a = alcanceDe(docente({ gruposAsignados: [g(7, 3), g(9, 4, 6)] }))
    expect(a.cursoIds).toEqual([3, 4])
    expect(a.grupoIds).toEqual([7, 9])
    expect(a.programaIds).toEqual([5, 6])
  })

  it('un curso completo en el perfil sigue sin filtrar por grupo', () => {
    const a = alcanceDe(docente({ cursoId: 3, gruposAsignados: [g(7, 3), g(8, 3)] }))
    expect(a.cursoIds).toEqual([3])
    expect(a.grupoIds).toBeNull()
  })

  it('curso completo más un grupo en otro curso: lista grupos, sin abrir el otro curso entero', () => {
    // La sesión añade los grupos del curso completo (7, 8) a los asignados.
    const a = alcanceDe(docente({ cursoId: 3, gruposAsignados: [g(7, 3), g(8, 3), g(20, 4)] }))
    expect(a.cursoIds).toEqual([3, 4])
    expect(a.grupoIds).toEqual([7, 8, 20])
  })

  it('el grupo fijado en el perfil (configuración antigua) se respeta', () => {
    const a = alcanceDe(docente({ cursoId: 3, grupoId: 7 }))
    expect(a.cursoIds).toEqual([3])
    expect(a.grupoIds).toEqual([7])
  })
})
