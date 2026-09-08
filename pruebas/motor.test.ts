import { beforeAll, describe, expect, it } from 'vitest'
import { calcular } from '@/scripts/seed/comprobar-motor'

/**
 * Pruebas del motor de indicadores contra los valores de referencia del
 * modelo de Power BI ya validado. Si estas cifras no cuadran, el motor
 * está mal y no tiene sentido seguir.
 *
 * Necesitan la base cargada: npm run seed + migración 04.
 */

type Resultado = Awaited<ReturnType<typeof calcular>>

let completo: Resultado

beforeAll(async () => {
  completo = await calcular()
}, 120_000)

describe('valores de referencia, conjunto completo sin filtros', () => {
  it.each([
    ['Índice de Trabajo en Equipo', 'ite', 66.7],
    ['Índice de Aprendizaje Autónomo', 'iau', 83.6],
    ['Índice de Comunicación Efectiva', 'icom', 74.9],
    ['Índice de Pensamiento Crítico', 'ipc', 74.1],
    ['Índice de Resolución de Problemas', 'irp', 68.0],
    ['Competencia Transversal Global', 'ctg', 73.4],
    ['Índice de Logro de Resultados de Aprendizaje', 'ilra', 57.8],
  ] as const)('%s = %s %%', (_nombre, clave, esperado) => {
    expect(completo.indices[clave]).toBeCloseTo(esperado, 1)
  })

  it('embudo = 36 · 36 · 36 · 24 · 11', () => {
    // La etapa 5 es 11, no 22: el 22 venía de una versión del modelo
    // anterior a que la rúbrica tuviera dimensión semanal.
    expect(completo.embudo).toEqual([36, 36, 36, 24, 11])
  })
})

describe('anclajes de la rúbrica semilla', () => {
  // Detectan el fallo de redondeo numeric vs float8: con banker's rounding
  // 26 de 1296 celdas bajan 1 punto y cuatro criterios dejan de cuadrar.
  it.each([
    ['NA', 70.0], ['NS', 72.5], ['EA', 75.0],
    ['TD', 78.7037], ['NIA', 69.2901], ['UEA', 71.2963],
  ] as const)('%s = %s %%', (codigo, esperado) => {
    expect(completo.subIndicadores[codigo.toLowerCase()]).toBeCloseTo(esperado, 2)
  })
})

describe('regla 2 · el truncamiento se aplica por estudiante', () => {
  it('ningún sub-indicador de razón supera 100 en ningún estudiante', () => {
    const conTope = ['tpi', 'rip', 'ncg', 'ta', 'fa', 'te', 'upr', 'cpp', 'tps', 'cid'] as const
    for (const e of completo.porEstudiante) {
      for (const k of conTope) {
        expect(e.sub[k], `${e.codigo}.${k}`).toBeLessThanOrEqual(100)
      }
    }
  })

  it('RIP satura: la mayoría llega al tope, así que el orden importa', () => {
    // Si se truncara el promedio en vez de cada estudiante, RIP no daría 99,54.
    const enTope = completo.porEstudiante.filter((e) => e.sub.rip === 100).length
    expect(enTope).toBeGreaterThan(30)
    expect(completo.subIndicadores.rip).toBeCloseTo(99.54, 1)
  })
})

describe('regla 3 · prorrateo por semanas', () => {
  let unaSemana: Resultado

  beforeAll(async () => {
    unaSemana = await calcular([1])
  }, 120_000)

  it('filtrar una semana no hunde el Índice de Trabajo en Equipo', () => {
    // Sin prorrateo caía de 66 % a 25 %. Con prorrateo se mantiene en rango.
    expect(unaSemana.indices.ite).toBeGreaterThan(50)
  })

  it.each(['ite', 'iau', 'icom'] as const)(
    '%s se mantiene en un rango razonable con una sola semana',
    (clave) => {
      const v = unaSemana.indices[clave]
      expect(v).toBeGreaterThan(40)
      expect(v).toBeLessThanOrEqual(100)
    }
  )

  it('CPP no se prorratea: es idéntico con una semana o con seis', () => {
    // Se divide entre las 5 actividades programadas, no entre 5 x factor.
    expect(unaSemana.subIndicadores.cpp).toBeCloseTo(completo.subIndicadores.cpp, 4)
  })

  it('ningún indicador queda en NaN al filtrar una sola semana', () => {
    // Un estudiante sin actividad en la semana 1 producía 0/0 en ICOL y
    // contaminaba todo el índice. En el conjunto completo no se ve.
    for (const e of unaSemana.porEstudiante) {
      for (const [k, v] of Object.entries(e.sub)) {
        expect(Number.isFinite(v), `${e.codigo}.${k} = ${v}`).toBe(true)
      }
      for (const k of ['ite', 'iau', 'icom', 'ipc', 'irp', 'ctg'] as const) {
        expect(Number.isFinite(e[k]), `${e.codigo}.${k}`).toBe(true)
      }
    }
  })
})

describe('regla 4 · escala', () => {
  it('todos los índices quedan en 0-100', () => {
    for (const e of completo.porEstudiante) {
      for (const k of ['ite', 'iau', 'icom', 'ipc', 'irp', 'ctg'] as const) {
        expect(e[k], `${e.codigo}.${k}`).toBeGreaterThanOrEqual(0)
        expect(e[k], `${e.codigo}.${k}`).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('codificación del origen', () => {
  it('CPP = 73,89 %, lo que confirma que "Sí" se leyó bien', () => {
    // Un fallo de codificación daría 0 y hundiría IAU a 68,8 sin avisar.
    expect(completo.subIndicadores.cpp).toBeCloseTo(73.89, 1)
  })
})

describe('composición de los índices', () => {
  it('cada índice es el promedio simple de sus sub-indicadores', () => {
    const e = completo.porEstudiante[0]
    const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
    expect(e.ite).toBeCloseTo(media([e.sub.icol, e.sub.tpi, e.sub.rip, e.sub.ncg, e.sub.ta]), 6)
    expect(e.iau).toBeCloseTo(media([e.sub.fa, e.sub.te, e.sub.upr, e.sub.cpp, e.sub.tps]), 6)
    expect(e.icom).toBeCloseTo(media([e.sub.clt, e.sub.npa, e.sub.cid, e.sub.crf]), 6)
    expect(e.ipc).toBeCloseTo(media([e.sub.na, e.sub.ns, e.sub.ea, e.sub.td]), 6)
    expect(e.irp).toBeCloseTo(media([e.sub.nia, e.sub.tra, e.sub.uea, e.sub.dpa]), 6)
  })

  it('CTG con pesos iguales es el promedio de los cinco índices', () => {
    for (const e of completo.porEstudiante) {
      const m = (e.ite + e.iau + e.icom + e.ipc + e.irp) / 5
      expect(e.ctg).toBeCloseTo(m, 6)
    }
  })
})

describe('catálogo de indicadores', () => {
  it('tiene los 36 indicadores con código único', async () => {
    const { CATALOGO } = await import('@/lib/kpi/catalogo')
    expect(CATALOGO).toHaveLength(36)
    expect(new Set(CATALOGO.map((i) => i.codigo)).size).toBe(36)
  })

  it('marca como semilla los seis de rúbrica y los dos índices que dependen de ella', async () => {
    const { CATALOGO, esSemilla } = await import('@/lib/kpi/catalogo')
    for (const c of ['NA', 'NS', 'EA', 'TD', 'NIA', 'UEA', 'IPC', 'IRP']) {
      expect(esSemilla(c), c).toBe(true)
    }
    // Los que sí vienen de datos reales no deben llevar la advertencia.
    for (const c of ['ITE', 'IAU', 'ICOM', 'CTG', 'ILRA']) {
      expect(esSemilla(c), c).toBe(false)
    }
    expect(CATALOGO.filter((i) => i.estadoDato === 'Sin fuente').map((i) => i.codigo))
      .toEqual(['TAR', 'NRA', 'TRR', 'EIA'])
  })

  it('el índice de brecha va en puntos, no en porcentaje', async () => {
    const { indicador } = await import('@/lib/kpi/catalogo')
    expect(indicador('IBA')!.escala).toBe('Puntos')
    expect(indicador('IBA')!.truncar100).toBe(false)
    expect(indicador('EIA')!.escala).toBe('Puntos')
  })

  it('CPP, TRA, DPA, NLA, ILRA, TLC, IBA y los del agente no tienen seguimiento semanal', async () => {
    const { indicador } = await import('@/lib/kpi/catalogo')
    for (const c of ['CPP', 'TRA', 'DPA', 'NLA', 'ILRA', 'TLC', 'IBA', 'TAR', 'NRA', 'TRR', 'EIA']) {
      expect(indicador(c)!.seguimientoSemanal, c).toBe('No')
    }
    // IAU e IRP son parciales porque uno de sus sub-indicadores no tiene semana.
    expect(indicador('IAU')!.seguimientoSemanal).toBe('Parcial')
    expect(indicador('IRP')!.seguimientoSemanal).toBe('Parcial')
    expect(indicador('CTG')!.seguimientoSemanal).toBe('Parcial')
  })

  it('todo indicador tiene nombre completo distinto de su código', async () => {
    const { CATALOGO, nombreDe } = await import('@/lib/kpi/catalogo')
    for (const i of CATALOGO) {
      expect(nombreDe(i.codigo), i.codigo).not.toBe(i.codigo)
      expect(i.nombre.length).toBeGreaterThan(5)
    }
  })
})
