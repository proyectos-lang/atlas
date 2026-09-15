'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteAuth } from '@/lib/auth/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { puedeVer, type Rol } from '@/lib/auth/alcance'

export interface EstadoEntrada {
  error?: string
}

export async function entrar(
  _previo: EstadoEntrada,
  formulario: FormData
): Promise<EstadoEntrada> {
  const email = String(formulario.get('email') ?? '').trim()
  const password = String(formulario.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Escribe tu correo y tu contraseña.' }
  }

  const supabase = await clienteAuth()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    // Mensaje deliberadamente genérico: no revela si el correo existe.
    return { error: 'Correo o contraseña incorrectos.' }
  }

  const db = clienteServidor()
  const { data: perfil } = await db
    .from('perfiles')
    .select('rol, activo')
    .eq('auth_user_id', data.user.id)
    .maybeSingle()

  if (!perfil) {
    await supabase.auth.signOut()
    return {
      error:
        'Tu cuenta no tiene un perfil asignado. Pide al administrador que te lo cree.',
    }
  }

  if (!perfil.activo) {
    await supabase.auth.signOut()
    return { error: 'Tu perfil está desactivado. Contacta al administrador.' }
  }

  revalidatePath('/', 'layout')

  // El middleware guarda en `siguiente` la ruta que se intentó abrir sin
  // sesión. Se respeta si el rol puede verla; si no, al panel de inicio.
  // Sólo rutas internas: un valor externo sería un redirect abierto.
  const siguiente = String(formulario.get('siguiente') ?? '')
  const destino =
    siguiente.startsWith('/') &&
    !siguiente.startsWith('//') &&
    puedeVer(perfil.rol as Rol, siguiente)
      ? siguiente
      : '/inicio'

  redirect(destino)
}

export async function salir() {
  const supabase = await clienteAuth()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/entrar')
}
