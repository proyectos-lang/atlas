/**
 * Crea cuentas de prueba, una por rol, con su alcance correspondiente.
 * Idempotente: si la cuenta ya existe, sólo asegura el perfil.
 *
 *   npx tsx scripts/seed/crear-perfiles.ts
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

const auth = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const db = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'atlas' },
})

const PASSWORD = 'atlas2026'

async function principal() {
  const { data: univ } = await db.from('universidades').select('id, codigo').order('codigo')
  const { data: cursos } = await db.from('cursos').select('id, codigo').order('codigo')
  const { data: est } = await db.from('usuarios').select('id, codigo').eq('rol', 'Estudiante').order('codigo').limit(1)

  if (!univ?.length || !cursos?.length || !est?.length) {
    console.error('Faltan datos base. Ejecutar antes: npm run seed')
    process.exit(1)
  }

  const u01 = univ.find((u) => u.codigo === 'U01')!
  const c01 = cursos.find((c) => c.codigo === 'C01')!
  const e001 = est[0]

  const cuentas = [
    { email: 'admin@atlas.edu',       nombre: 'Ana Admin',        rol: 'admin',       ambito: {} },
    { email: 'coordinador@atlas.edu', nombre: 'Carlos Coordina',  rol: 'coordinador', ambito: { universidad_id: u01.id } },
    { email: 'asesor@atlas.edu',      nombre: 'Andrea Asesora',   rol: 'asesor',      ambito: { universidad_id: u01.id } },
    { email: 'docente@atlas.edu',     nombre: 'Diego Docente',    rol: 'docente',     ambito: { universidad_id: u01.id, curso_id: c01.id } },
    { email: 'estudiante@atlas.edu',  nombre: 'Elena Estudiante', rol: 'estudiante',  ambito: { universidad_id: u01.id, curso_id: c01.id, usuario_id: e001.id } },
  ]

  for (const c of cuentas) {
    // ¿Ya existe el perfil?
    const { data: existente } = await db
      .from('perfiles').select('id, auth_user_id').eq('email', c.email).maybeSingle()

    let authId = existente?.auth_user_id as string | undefined

    if (!authId) {
      const { data: creado, error } = await auth.auth.admin.createUser({
        email: c.email, password: PASSWORD, email_confirm: true,
      })
      if (error) {
        // Puede existir en auth sin perfil: lo buscamos.
        const { data: lista } = await auth.auth.admin.listUsers()
        const encontrado = lista?.users.find((u) => u.email === c.email)
        if (!encontrado) {
          console.error(`  ${c.email}: ${error.message}`)
          continue
        }
        authId = encontrado.id
      } else {
        authId = creado.user!.id
      }
    }

    const { error: eP } = await db.from('perfiles').upsert(
      {
        auth_user_id: authId,
        nombre: c.nombre,
        email: c.email,
        rol: c.rol,
        universidad_id: null,
        curso_id: null,
        usuario_id: null,
        activo: true,
        ...c.ambito,
      },
      { onConflict: 'auth_user_id' }
    )
    if (eP) console.error(`  ${c.email}: ${eP.message}`)
    else console.log(`  ${c.rol.padEnd(12)} ${c.email}`)
  }

  console.log(`\nContraseña para todas: ${PASSWORD}`)
  console.log('Cambiala antes de cualquier uso real.')
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
