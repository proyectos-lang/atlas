import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { clienteServidor } from '@/lib/supabase/servidor'
import {
  alcanceDe, INICIO_POR_ROL, puedeVer,
  type Alcance, type Perfil, type Rol,
} from './alcance'

/**
 * Cliente ligado a las cookies de la petición: sólo resuelve la sesión.
 * La lectura de datos de negocio nunca pasa por aquí.
 */
export async function clienteAuth() {
  const almacen = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (galletas) => {
          try {
            for (const { name, value, options } of galletas) {
              almacen.set(name, value, options)
            }
          } catch {
            // Server Component: las cookies las refresca el middleware.
          }
        },
      },
    }
  )
}

/** Perfil de la sesión actual, o null si no hay sesión o está inactivo. */
export async function perfilActual(): Promise<Perfil | null> {
  const supabase = await clienteAuth()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const db = clienteServidor()
  const { data, error } = await db
    .from('perfiles')
    .select('id, auth_user_id, nombre, email, rol, universidad_id, curso_id, usuario_id, activo')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !data || !data.activo) return null

  return {
    id: Number(data.id),
    authUserId: String(data.auth_user_id),
    nombre: String(data.nombre),
    email: String(data.email),
    rol: data.rol as Rol,
    universidadId: data.universidad_id === null ? null : Number(data.universidad_id),
    cursoId: data.curso_id === null ? null : Number(data.curso_id),
    usuarioId: data.usuario_id === null ? null : Number(data.usuario_id),
    activo: Boolean(data.activo),
  }
}

/**
 * Exige sesión válida y devuelve perfil y alcance.
 * Sin sesión redirige a /entrar; fuera de rol, a la página inicial del rol
 * (redirección, no error, según lo pedido).
 */
export async function exigirSesion(ruta?: string): Promise<{
  perfil: Perfil
  alcance: Alcance
}> {
  const perfil = await perfilActual()
  if (!perfil) redirect('/entrar')

  if (ruta && !puedeVer(perfil.rol, ruta)) {
    redirect(INICIO_POR_ROL[perfil.rol])
  }

  return { perfil, alcance: alcanceDe(perfil) }
}

/** Exige un rol concreto; si no, redirige a su inicio. */
export async function exigirRol(roles: readonly Rol[]): Promise<{
  perfil: Perfil
  alcance: Alcance
}> {
  const { perfil, alcance } = await exigirSesion()
  if (!roles.includes(perfil.rol)) redirect(INICIO_POR_ROL[perfil.rol])
  return { perfil, alcance }
}
