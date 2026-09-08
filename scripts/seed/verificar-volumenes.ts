/**
 * Verifica la carga: volúmenes por tabla y anclajes de la semilla de rúbrica.
 * Si algo no cuadra, el motor de indicadores no puede dar los valores de
 * referencia y no tiene sentido seguir.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const url = process.env.SUPABASE_URL
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !clave) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const db = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'atlas' },
})

const VOLUMENES: Record<string, number> = {
  universidades: 3,
  cursos: 3,
  usuarios: 36,
  actividades: 15,
  semanas: 6,
  moodle_logs: 216,
  foros: 216,
  colaboracion: 216,
  evaluaciones: 180,
  resultados_aprendizaje: 180,
  recomendaciones_ia: 39,
  rubrica_criterios: 6,
  rubrica: 1296,
  parametros: 54,
}

/** Σobtenido / Σmáximo por criterio, comprobados por simulación exacta. */
const ANCLAJES: Record<string, { obt: number; max: number }> = {
  NA:  { obt: 1512,  max: 2160 },
  NS:  { obt: 15660, max: 21600 },
  EA:  { obt: 810,   max: 1080 },
  TD:  { obt: 850,   max: 1080 },
  NIA: { obt: 898,   max: 1296 },
  UEA: { obt: 616,   max: 864 },
}

async function contar(tabla: string) {
  const { count, error } = await db.from(tabla).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${tabla}: ${error.message}`)
  return count ?? 0
}

async function principal() {
  let ok = true

  console.log('VOLUMENES')
  for (const [tabla, esperado] of Object.entries(VOLUMENES)) {
    const real = await contar(tabla)
    const bien = real === esperado
    ok &&= bien
    console.log(
      `  ${tabla.padEnd(26)} ${String(real).padStart(5)}  esperado ${String(esperado).padStart(5)}  ${bien ? 'OK' : 'DIFIERE'}`
    )
  }

  // ---------- Anclajes de rúbrica ----------
  // Detecta el fallo de redondeo numeric vs float8: con banker's rounding
  // 26 de 1296 celdas bajan 1 punto y NA, EA, TD y NIA dejan de cuadrar.
  console.log('\nANCLAJES DE RUBRICA')
  const { data: criterios, error: e1 } = await db
    .from('rubrica_criterios').select('id, codigo_kpi')
  if (e1) throw new Error(e1.message)

  const porCriterio = new Map<string, { obt: number; max: number }>()
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from('rubrica')
      .select('criterio_id, valor_obtenido, valor_maximo')
      .range(desde, desde + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    for (const f of data) {
      const cod = criterios!.find((c) => c.id === f.criterio_id)?.codigo_kpi
      if (!cod) continue
      const a = porCriterio.get(cod) ?? { obt: 0, max: 0 }
      a.obt += Number(f.valor_obtenido)
      a.max += Number(f.valor_maximo)
      porCriterio.set(cod, a)
    }
    if (data.length < 1000) break
  }

  const pct: Record<string, number> = {}
  for (const [cod, esp] of Object.entries(ANCLAJES)) {
    const real = porCriterio.get(cod) ?? { obt: 0, max: 0 }
    const bien = real.obt === esp.obt && real.max === esp.max
    ok &&= bien
    pct[cod] = real.max ? (100 * real.obt) / real.max : 0
    console.log(
      `  ${cod.padEnd(5)} ${String(real.obt).padStart(6)}/${String(real.max).padEnd(6)}` +
        ` esperado ${String(esp.obt).padStart(6)}/${String(esp.max).padEnd(6)}` +
        ` ${pct[cod].toFixed(2).padStart(6)}%  ${bien ? 'OK' : 'DIFIERE'}`
    )
  }

  if (Object.keys(pct).length === 6) {
    const ipc = (pct.NA + pct.NS + pct.EA + pct.TD) / 4
    console.log(`\n  Indice de Pensamiento Critico = ${ipc.toFixed(2)}%  (referencia 74,1)`)
  }

  console.log(
    ok
      ? '\nVERIFICACION CORRECTA'
      : '\nHAY DIFERENCIAS: revisar antes de seguir con el motor de indicadores.'
  )
  if (!ok) process.exitCode = 1
}

principal().catch((e) => {
  console.error('\nError:', e instanceof Error ? e.message : e)
  process.exit(1)
})
