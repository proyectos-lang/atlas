import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { clienteServidor } from '@/lib/supabase/servidor'
import {
  alcanceDe, inicioDe, perfilPuedeVer,
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
    .select('id, auth_user_id, nombre, email, rol, universidad_id, programa_id, curso_id, grupo_id, usuario_id, activo, modulos')
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
    programaId: data.programa_id == null ? null : Number(data.programa_id),
    cursoId: data.curso_id === null ? null : Number(data.curso_id),
    grupoId: data.grupo_id == null ? null : Number(data.grupo_id),
    usuarioId: data.usuario_id === null ? null : Number(data.usuario_id),
    activo: Boolean(data.activo),
    // Ausente (columna sin migrar) o NULL significan lo mismo: sin
    // personalizar. El array vacío, en cambio, sí es una decisión.
    modulos: Array.isArray(data.modulos) ? data.modulos.map(String) : null,
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

  if (ruta && !perfilPuedeVer(perfil, ruta)) {
    // A dónde mandarlo: nunca a una página que tampoco pueda ver, o el
    // redirect rebotaría contra esta misma comprobación sin fin.
    const destino = inicioDe(perfil)
    redirect(destino ?? '/sin-acceso')
  }

  return { perfil, alcance: alcanceDe(perfil) }
}

/**
 * Exige un rol concreto, o que el administrador haya concedido la ruta.
 *
 * `ruta` es lo que arregla una incoherencia que se veía desde la interfaz:
 * el menú mostraba un enlace porque el PERFIL tenía ese módulo concedido,
 * y la página lo rechazaba porque su ROL no estaba en la lista. El usuario
 * pulsaba y volvía al inicio sin explicación.
 *
 * Con `ruta`, un módulo concedido a mano pesa más que la lista de roles:
 * es lo que el administrador decidió para esa persona en concreto. Sin
 * `ruta`, se comporta como antes y sólo mira el rol.
 */
export async function exigirRol(
  roles: readonly Rol[],
  ruta?: string
): Promise<{
  perfil: Perfil
  alcance: Alcance
}> {
  const { perfil, alcance } = await exigirSesion()

  const porRol = roles.includes(perfil.rol)
  // Sólo cuenta si el administrador personalizó los módulos de ESTE
  // perfil: `modulos` en null significa «usa los de su rol», y entonces
  // la concesión no añadiría nada que el rol no diera ya.
  const concedido =
    ruta !== undefined && perfil.modulos !== null && perfilPuedeVer(perfil, ruta)

  if (!porRol && !concedido) redirect(inicioDe(perfil) ?? '/sin-acceso')

  return { perfil, alcance }
}
