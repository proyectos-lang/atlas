import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente de navegador. SOLO para autenticación (login, logout, sesión).
 * Usa la clave anónima y nunca lee datos de negocio: el esquema `atlas`
 * se consulta exclusivamente desde el servidor con el Alcance del perfil.
 */
export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
