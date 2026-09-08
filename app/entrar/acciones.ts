'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { clienteAuth } from '@/lib/auth/sesion'
import { clienteServidor } from '@/lib/supabase/servidor'
import { INICIO_POR_ROL, type Rol } from '@/lib/auth/alcance'

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
  redirect(INICIO_POR_ROL[perfil.rol as Rol])
}

export async function salir() {
  const supabase = await clienteAuth()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/entrar')
}
