/**
 * Carga los 36 indicadores del catálogo. Idempotente por código.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { CATALOGO } from '../../lib/kpi/catalogo'

config({ path: '.env.local' })

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }, db: { schema: 'atlas' },
})

async function principal() {
  const filas = CATALOGO.map((i) => ({
    orden: i.orden,
    codigo: i.codigo,
    nombre: i.nombre,
    competencia: i.competencia,
    nivel: i.nivel,
    fuente: i.fuente,
    campos: null,
    formula_corta: i.formulaCorta,
    escala: i.escala,
    truncar_100: i.truncar100,
    estado_dato: i.estadoDato,
    peso: ['ITE', 'IAU', 'ICOM', 'IPC', 'IRP'].includes(i.codigo) ? 0.2 : 0,
    seguimiento_semanal: i.seguimientoSemanal,
  }))

  const { error } = await db.from('catalogo_kpi').upsert(filas, { onConflict: 'codigo' })
  if (error) throw new Error(error.message)

  const { count } = await db.from('catalogo_kpi').select('*', { count: 'exact', head: true })
  console.log(`catalogo_kpi: ${count} indicadores`)

  const semilla = filas.filter((f) => f.estado_dato === 'Semilla').map((f) => f.codigo)
  const sinFuente = filas.filter((f) => f.estado_dato === 'Sin fuente').map((f) => f.codigo)
  console.log(`  con dato semilla: ${semilla.join(', ')}`)
  console.log(`  sin fuente:       ${sinFuente.join(', ')}`)
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
