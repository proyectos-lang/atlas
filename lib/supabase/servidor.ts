import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase con service role key, apuntado al esquema `atlas`.
 *
 * SOLO servidor. La import de 'server-only' hace fallar la compilación
 * si algún componente cliente intenta importar este módulo.
 *
 * RLS está deshabilitado a propósito: el control de acceso se aplica
 * en el servidor mediante el Alcance del perfil (lib/auth/alcance.ts).
 * Ninguna consulta debe ejecutarse sin un Alcance.
 */
function crear() {
  const url = process.env.SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !clave) {
    throw new Error(
      'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.'
    )
  }

  return createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'atlas' },
  })
}

export type ClienteAtlas = ReturnType<typeof crear>

let cliente: ClienteAtlas | null = null

export function clienteServidor(): ClienteAtlas {
  if (!cliente) cliente = crear()
  return cliente
}
