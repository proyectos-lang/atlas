import { beforeAll, describe, expect, it } from 'vitest'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { calcular } from '@/scripts/seed/comprobar-motor'

config({ path: '.env.local' })

/**
 * Contrasta las vistas SQL con la implementación TypeScript de referencia.
 * Son dos implementaciones independientes de las mismas fórmulas: si ambas
 * coinciden y dan los valores de referencia, el motor está bien.
 *
 * Requiere la migración 05 aplicada.
 */
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }, db: { schema: 'atlas' },
})

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length

let sql: Record<string, number>[]
let ts: Awaited<ReturnType<typeof calcular>>

beforeAll(async () => {
  const [r, t] = await Promise.all([
    db.rpc('kpi_indice', { p_semanas: null }),
    calcular(),
  ])
  if (r.error) throw new Error(`kpi_indice: ${r.error.message}. ¿Falta la migración 05?`)
  sql = (r.data ?? []) as Record<string, number>[]
  ts = t
}, 120_000)

describe('las vistas SQL reproducen los valores de referencia', () => {
  it.each([
    ['ite', 66.7], ['iau', 83.6], ['icom', 74.9],
    ['ipc', 74.1], ['irp', 68.0], ['ctg', 73.4],
  ] as const)('%s', (clave, esperado) => {
    expect(media(sql.map((f) => Number(f[clave])))).toBeCloseTo(esperado, 1)
  })

  it('devuelve un renglón por estudiante', () => {
    expect(sql).toHaveLength(36)
  })
})

describe('las vistas SQL coinciden con el cálculo de referencia', () => {
  it('estudiante por estudiante, en los seis índices', async () => {
    const { data: usuarios } = await db.from('usuarios').select('id, codigo')
    const codigoDe = new Map((usuarios ?? []).map((u) => [Number(u.id), String(u.codigo)]))
    const porCodigo = new Map(ts.porEstudiante.map((e) => [e.codigo, e]))

    let comparados = 0
    for (const f of sql) {
      const cod = codigoDe.get(Number(f.usuario_id))!
      const e = porCodigo.get(cod)!
      for (const k of ['ite', 'iau', 'icom', 'ipc', 'irp', 'ctg'] as const) {
        expect(Number(f[k]), `${cod}.${k}`).toBeCloseTo(e[k], 6)
        comparados++
      }
    }
    expect(comparados).toBe(36 * 6)
  }, 60_000)
})

describe('kpi_ilo', () => {
  it('ILRA = 57,8 % y la brecha va en puntos', async () => {
    const { data, error } = await db.rpc('kpi_ilo')
    if (error) throw new Error(error.message)
    const filas = (data ?? []) as Record<string, number>[]
    expect(media(filas.map((f) => Number(f.ilra)))).toBeCloseTo(57.8, 1)

    // IBA = logro esperado (85) menos logro alcanzado. En puntos, no en %.
    const tlc = media(filas.map((f) => Number(f.tlc)))
    const iba = media(filas.map((f) => Number(f.iba)))
    expect(iba).toBeCloseTo(85 - tlc, 4)
  }, 60_000)
})

describe('kpi_embudo', () => {
  it('sin filtros da 36 · 36 · 36 · 24 · 11', async () => {
    const { data, error } = await db.rpc('kpi_embudo', {
      p_universidades: null, p_cursos: null, p_usuarios: null,
    })
    if (error) throw new Error(error.message)
    const conteos = (data ?? []).map((e: Record<string, unknown>) => Number(e.conteo))
    expect(conteos).toEqual([36, 36, 36, 24, 11])
  }, 60_000)

  it('el embudo por curso suma el total en cada etapa', async () => {
    const { data: cursos } = await db.from('cursos').select('id').order('codigo')
    const porCurso: number[][] = []
    for (const c of cursos ?? []) {
      const { data } = await db.rpc('kpi_embudo', {
        p_universidades: null, p_cursos: [Number(c.id)], p_usuarios: null,
      })
      porCurso.push((data ?? []).map((e: Record<string, unknown>) => Number(e.conteo)))
    }
    for (let etapa = 0; etapa < 5; etapa++) {
      const suma = porCurso.reduce((t, c) => t + c[etapa], 0)
      expect(suma, `etapa ${etapa + 1}`).toBe([36, 36, 36, 24, 11][etapa])
    }
  }, 120_000)
})

describe('regla 3 en SQL · el prorrateo evita el desplome semanal', () => {
  it('filtrar una semana no hunde el Índice de Trabajo en Equipo', async () => {
    const { data } = await db.rpc('kpi_indice', { p_semanas: [1] })
    const ite = media((data ?? []).map((f: Record<string, unknown>) => Number(f.ite)))
    // Sin prorrateo caía a ~25 %. Con prorrateo se mantiene por encima de 50.
    expect(ite).toBeGreaterThan(50)
  }, 60_000)

  it('el ámbito de las seis semanas equivale a no filtrar', async () => {
    const { data } = await db.rpc('kpi_indice', { p_semanas: [1, 2, 3, 4, 5, 6] })
    const ite = media((data ?? []).map((f: Record<string, unknown>) => Number(f.ite)))
    expect(ite).toBeCloseTo(media(sql.map((f) => Number(f.ite))), 6)
  }, 60_000)
})

describe('indicadores del agente sin ciclo de revisión', () => {
  it('los cuatro son null, nunca 0 %', async () => {
    // Las 39 recomendaciones del origen están todas pendientes: no hay
    // resultados todavía. Un 0 % afirmaría que se rechazó todo.
    const { data } = await db.from('recomendaciones_ia').select('estado, fecha_respuesta')
    const huboRevision = (data ?? []).some(
      (r) => r.estado !== 'Pendiente de revisión docente' || r.fecha_respuesta !== null
    )
    expect(huboRevision, 'precondición: aún no hay revisiones').toBe(false)

    const { indicadoresAgente } = await import('@/lib/kpi/indicadores')
    const ag = await indicadoresAgente({
      rol: 'admin', universidadIds: null, programaIds: null,
  cursoIds: null, grupoIds: null, usuarioIds: null, perfilId: 1,
    })
    expect(ag).toEqual({ tar: null, nra: null, trr: null, eia: null })
  }, 60_000)
})
