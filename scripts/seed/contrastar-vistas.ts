/**
 * Contrasta las vistas SQL con la implementación TypeScript de referencia.
 *
 * Son dos implementaciones independientes de las mismas fórmulas. Si ambas
 * coinciden y dan los valores de referencia, el motor está bien; si difieren,
 * una de las dos tiene un error y hay que encontrarlo antes de seguir.
 *
 * Requiere la migración 05 aplicada.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { calcular } from './comprobar-motor'

config({ path: '.env.local' })

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }, db: { schema: 'atlas' },
})

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length

async function principal() {
  const { data: sql, error } = await db.rpc('kpi_indice', { p_semanas: null })
  if (error) {
    console.error(`No se pudo llamar a kpi_indice: ${error.message}`)
    console.error('¿Está aplicada la migración 05_vistas_kpi.sql?')
    process.exit(1)
  }

  const ts = await calcular()
  const filasSql = (sql ?? []) as Record<string, number>[]

  console.log(`Vistas SQL: ${filasSql.length} estudiantes`)
  console.log(`TypeScript: ${ts.porEstudiante.length} estudiantes\n`)

  const claves = ['ite', 'iau', 'icom', 'ipc', 'irp', 'ctg'] as const
  console.log('PROMEDIOS DEL CONJUNTO COMPLETO')
  console.log('  indice      SQL     TypeScript    dif')
  let ok = true
  for (const k of claves) {
    const a = media(filasSql.map((f) => Number(f[k])))
    const b = ts.indices[k]
    const d = Math.abs(a - b)
    ok &&= d < 0.005
    console.log(
      `  ${k.toUpperCase().padEnd(6)} ${a.toFixed(4).padStart(9)} ${b.toFixed(4).padStart(12)}` +
        ` ${d.toFixed(6).padStart(10)}  ${d < 0.005 ? 'OK' : 'DIFIERE'}`
    )
  }

  // Contraste estudiante a estudiante: un promedio puede coincidir por azar.
  console.log('\nCONTRASTE POR ESTUDIANTE')
  const { data: usuarios } = await db.from('usuarios').select('id, codigo')
  const codigoDe = new Map((usuarios ?? []).map((u) => [Number(u.id), String(u.codigo)]))
  const porCodigoTs = new Map(ts.porEstudiante.map((e) => [e.codigo, e]))

  let peor = 0
  let peorDonde = ''
  for (const f of filasSql) {
    const cod = codigoDe.get(Number(f.usuario_id))
    const e = cod ? porCodigoTs.get(cod) : undefined
    if (!e) continue
    for (const k of claves) {
      const d = Math.abs(Number(f[k]) - e[k])
      if (d > peor) { peor = d; peorDonde = `${cod}.${k.toUpperCase()}` }
    }
  }
  console.log(`  mayor diferencia: ${peor.toFixed(8)} en ${peorDonde || '—'}`)
  ok &&= peor < 0.005

  // Embudo
  const { data: emb } = await db.rpc('kpi_embudo', {
    p_universidades: null, p_cursos: null, p_usuarios: null,
  })
  const conteosSql = (emb ?? []).map((e: Record<string, unknown>) => Number(e.conteo))
  console.log(`\nEMBUDO`)
  console.log(`  SQL:        ${conteosSql.join(' · ')}`)
  console.log(`  TypeScript: ${ts.embudo.join(' · ')}`)
  const embudoOk = JSON.stringify(conteosSql) === JSON.stringify(ts.embudo)
  ok &&= embudoOk
  console.log(`  ${embudoOk ? 'COINCIDEN' : 'DIFIEREN'}`)

  console.log(ok
    ? '\nLAS DOS IMPLEMENTACIONES COINCIDEN'
    : '\nHAY DIFERENCIAS entre las vistas SQL y el cálculo de referencia.')
  if (!ok) process.exitCode = 1
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
