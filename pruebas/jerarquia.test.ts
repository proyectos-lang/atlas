import { describe, expect, it } from 'vitest'
import {
  alcanceDe, alcanceVacio, aplicarFiltros, restringir,
  type Perfil, type Rol,
} from '@/lib/auth/alcance'

/**
 * Jerarquía Universidad → Programa → Curso → Grupo → estudiantes.
 *
 * Lo que se protege aquí es que añadir niveles no amplíe el acceso de
 * nadie: el caso peligroso es el coordinador, cuyo `universidad_id`
 * apuntaba antes a una fila que en realidad era un programa.
 */

const perfil = (rol: Rol, a: Partial<Perfil> = {}): Perfil => ({
  id: 1, authUserId: 'u', nombre: 'X', email: 'x@y.z', activo: true, modulos: null,
  rol,
  universidadId: a.universidadId ?? null,
  programaId: a.programaId ?? null,
  cursoId: a.cursoId ?? null,
  grupoId: a.grupoId ?? null,
  usuarioId: a.usuarioId ?? null,
})

describe('el coordinador de un programa no ve los demás de su universidad', () => {
  it('con programa asignado se ciñe al programa, no a la universidad', () => {
    // Es la escalada de privilegios que la jerarquía podía introducir: si
    // se ciñera sólo por universidad, una institución con dos programas
    // mostraría el ajeno.
    const a = alcanceDe(perfil('coordinador', { universidadId: 1, programaId: 7 }))
    expect(a.programaIds).toEqual([7])
    expect(a.universidadIds).toBeNull()
  })

  it('sin programa asignado conserva el comportamiento anterior', () => {
    const a = alcanceDe(perfil('coordinador', { universidadId: 1 }))
    expect(a.universidadIds).toEqual([1])
    expect(a.programaIds).toBeNull()
  })

  it('el asesor sigue la misma regla', () => {
    const a = alcanceDe(perfil('asesor', { universidadId: 1, programaId: 7 }))
    expect(a.programaIds).toEqual([7])
    expect(a.universidadIds).toBeNull()
  })

  it('un coordinador sin ningún ámbito no ve nada', () => {
    // Fail-closed: ante configuración incompleta se niega, no se abre.
    const a = alcanceDe(perfil('coordinador'))
    expect(a.universidadIds).toEqual([])
    expect(alcanceVacio(a)).toBe(true)
  })
})

describe('el docente se ciñe a su grupo cuando lo tiene', () => {
  it('con grupo asignado, el grupo entra en el alcance', () => {
    const a = alcanceDe(perfil('docente', { cursoId: 3, grupoId: 9 }))
    expect(a.cursoIds).toEqual([3])
    expect(a.grupoIds).toEqual([9])
  })

  it('sin grupo ve el curso entero, como antes', () => {
    const a = alcanceDe(perfil('docente', { cursoId: 3 }))
    expect(a.cursoIds).toEqual([3])
    expect(a.grupoIds).toBeNull()
  })

  it('un docente sin curso no ve nada', () => {
    expect(alcanceVacio(alcanceDe(perfil('docente')))).toBe(true)
  })
})

describe('admin y estudiante no cambian', () => {
  it('admin sigue sin restricción en las cinco dimensiones', () => {
    const a = alcanceDe(perfil('admin'))
    expect(a.universidadIds).toBeNull()
    expect(a.programaIds).toBeNull()
    expect(a.cursoIds).toBeNull()
    expect(a.grupoIds).toBeNull()
    expect(a.usuarioIds).toBeNull()
  })

  it('el estudiante sigue ceñido a sí mismo', () => {
    const a = alcanceDe(perfil('estudiante', { usuarioId: 5, grupoId: 9 }))
    expect(a.usuarioIds).toEqual([5])
  })

  it('un estudiante sin registro asignado no ve nada', () => {
    expect(alcanceVacio(alcanceDe(perfil('estudiante')))).toBe(true)
  })
})

describe('alcanceVacio cubre las dimensiones nuevas', () => {
  it('una lista vacía en programa o grupo vacía el alcance', () => {
    const base = alcanceDe(perfil('admin'))
    expect(alcanceVacio({ ...base, programaIds: [] })).toBe(true)
    expect(alcanceVacio({ ...base, grupoIds: [] })).toBe(true)
  })

  it('null no vacía: significa sin restricción', () => {
    expect(alcanceVacio(alcanceDe(perfil('admin')))).toBe(false)
  })
})

describe('los filtros no amplían lo permitido', () => {
  it('pedir otro programa por la URL no lo concede', () => {
    const a = alcanceDe(perfil('coordinador', { universidadId: 1, programaId: 7 }))
    const forzado = aplicarFiltros(a, { programaIds: [99] })
    expect(forzado.programaIds).toEqual([])
    expect(alcanceVacio(forzado)).toBe(true)
  })

  it('pedir otro grupo por la URL no lo concede', () => {
    const a = alcanceDe(perfil('docente', { cursoId: 3, grupoId: 9 }))
    const forzado = aplicarFiltros(a, { grupoIds: [99] })
    expect(forzado.grupoIds).toEqual([])
  })

  it('un grupo dentro de lo permitido sí se aplica', () => {
    const a = alcanceDe(perfil('admin'))
    expect(aplicarFiltros(a, { grupoIds: [4] }).grupoIds).toEqual([4])
  })

  it('restringir se comporta igual en las dimensiones nuevas', () => {
    expect(restringir([1, 2, 3], [2, 9])).toEqual([2])
    expect(restringir(null, [2])).toEqual([2])
    expect(restringir([1, 2], null)).toEqual([1, 2])
  })
})
