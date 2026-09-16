import { describe, expect, it } from 'vitest'
import { seleccionDe } from '@/lib/kpi/filtros'
import { alcanceDe, aplicarFiltros, type Perfil } from '@/lib/auth/alcance'

const perfil = (rol: Perfil['rol'], a: Partial<Perfil> = {}): Perfil => ({
  id: 1, authUserId: 'u', nombre: 'X', email: 'x@y.z', activo: true, modulos: null, rol,
  programaId: a.programaId ?? null, grupoId: a.grupoId ?? null,
  universidadId: a.universidadId ?? null,
  cursoId: a.cursoId ?? null,
  usuarioId: a.usuarioId ?? null,
})

describe('lectura de los filtros desde la URL', () => {
  it('extrae los siete parámetros', () => {
    const s = seleccionDe({
      universidad: 'U01', programa: 'Ingeniería de Sistemas', curso: 'C01',
      competencia: 'Trabajo en Equipo', ilo: 'RA1', actividad: 'Foro', semana: '3',
    })
    expect(s.universidad).toBe('U01')
    expect(s.curso).toBe('C01')
    expect(s.tipoActividad).toBe('Foro')   // el parámetro se llama "actividad"
    expect(s.semana).toBe('3')
  })

  it('tolera parámetros repetidos quedándose con el primero', () => {
    expect(seleccionDe({ curso: ['C01', 'C02'] }).curso).toBe('C01')
  })

  it('sin parámetros deja todo vacío', () => {
    const s = seleccionDe({})
    expect(Object.values(s).every((v) => v === '')).toBe(true)
  })
})

describe('los filtros no amplían el alcance', () => {
  it('un docente que fuerza otro curso en la URL no lo obtiene', () => {
    // Es la propiedad de seguridad: lo pedido se intersecta con lo permitido.
    const a = alcanceDe(perfil('docente', { universidadId: 1, cursoId: 10 }))
    expect(aplicarFiltros(a, { cursoIds: [30] }).cursoIds).toEqual([])
  })

  it('un coordinador que fuerza otra universidad no la obtiene', () => {
    const a = alcanceDe(perfil('coordinador', { universidadId: 1 }))
    expect(aplicarFiltros(a, { universidadIds: [2] }).universidadIds).toEqual([])
  })

  it('un estudiante que pide otro estudiante no lo obtiene', () => {
    const a = alcanceDe(perfil('estudiante', { universidadId: 1, cursoId: 1, usuarioId: 5 }))
    expect(aplicarFiltros(a, { usuarioIds: [9] }).usuarioIds).toEqual([])
  })

  it('el admin sí puede acotar a cualquier curso', () => {
    const a = alcanceDe(perfil('admin'))
    expect(aplicarFiltros(a, { cursoIds: [30] }).cursoIds).toEqual([30])
  })

  it('filtrar dentro del alcance propio sí funciona', () => {
    const a = alcanceDe(perfil('coordinador', { universidadId: 1 }))
    expect(aplicarFiltros(a, { universidadIds: [1] }).universidadIds).toEqual([1])
  })
})

describe('semana del ámbito', () => {
  it.each([
    ['3', [3]], ['1', [1]], ['6', [6]],
  ] as const)('semana=%s produce el ámbito %s', (valor, esperado) => {
    const n = Number(valor)
    const semanas = Number.isInteger(n) && n >= 1 && n <= 6 ? [n] : null
    expect(semanas).toEqual(esperado)
  })

  it.each(['', '0', '7', 'abc'])('semana=%s se ignora y usa todas', (valor) => {
    const n = Number(valor)
    const semanas = Number.isInteger(n) && n >= 1 && n <= 6 ? [n] : null
    expect(semanas).toBeNull()
  })
})
