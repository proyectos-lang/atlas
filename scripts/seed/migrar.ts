/**
 * Aplica en orden los archivos .sql de supabase/migraciones.
 * Requiere DATABASE_URL (conexión directa a Postgres).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local' })

const DIR = join(process.cwd(), 'supabase', 'migraciones')

async function principal() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      'Falta DATABASE_URL en .env.local.\n' +
        'Supabase > Project Settings > Database > Connection string > URI'
    )
    process.exit(1)
  }

  const archivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
  const cliente = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })
  await cliente.connect()

  try {
    for (const archivo of archivos) {
      const sql = readFileSync(join(DIR, archivo), 'utf8')
      process.stdout.write(`  ${archivo} ... `)
      await cliente.query(sql)
      console.log('ok')
    }
    console.log('\nMigraciones aplicadas.')
  } catch (e) {
    console.error('\nError:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  } finally {
    await cliente.end()
  }
}

principal()
