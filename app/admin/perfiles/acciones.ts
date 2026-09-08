'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Rol } from '@/lib/auth/alcance'
import { exigirRol } from '@/lib/auth/sesion'

export interface EstadoPerfil {
  error?: string
  ok?: string
}

const ROLES: Rol[] = ['admin', 'coordinador', 'asesor', 'docente', 'estudiante']

function nuloOEntero(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Crea un usuario en Supabase Auth y su perfil en atlas.perfiles.
 * Sólo admin. El alcance se asigna aquí; sin él, un rol restringido
 * no verá ningún dato (alcance vacío, no abierto).
 */
export async function crearPerfil(
  _previo: EstadoPerfil,
  formulario: FormData
): Promise<EstadoPerfil> {
  await exigirRol(['admin'])

  const nombre = String(formulario.get('nombre') ?? '').trim()
  const email = String(formulario.get('email') ?? '').trim()
  const password = String(formulario.get('password') ?? '')
  const rol = String(formulario.get('rol') ?? '') as Rol

  if (!nombre || !email || !password) {
    return { error: 'Nombre, correo y contraseña son obligatorios.' }
  }
  if (!ROLES.includes(rol)) return { error: 'Rol no válido.' }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }

  const universidadId = nuloOEntero(formulario.get('universidad_id'))
  const cursoId = nuloOEntero(formulario.get('curso_id'))
  const usuarioId = nuloOEntero(formulario.get('usuario_id'))

  // Coherencia del alcance: un rol restringido sin su ámbito no vería nada.
  if ((rol === 'coordinador' || rol === 'asesor') && universidadId === null) {
    return { error: 'Un coordinador o asesor necesita una universidad asignada.' }
  }
  if (rol === 'docente' && cursoId === null) {
    return { error: 'Un docente necesita un curso asignado.' }
  }
  if (rol === 'estudiante' && usuarioId === null) {
    return { error: 'Un estudiante necesita un registro de estudiante asignado.' }
  }

  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const { data: creado, error: eAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (eAuth || !creado.user) {
    return { error: `No se pudo crear la cuenta: ${eAuth?.message ?? 'desconocido'}` }
  }

  const db = clienteServidor()
  const { error: ePerfil } = await db.from('perfiles').insert({
    auth_user_id: creado.user.id,
    nombre,
    email,
    rol,
    universidad_id: universidadId,
    curso_id: cursoId,
    usuario_id: usuarioId,
    activo: true,
  })

  if (ePerfil) {
    // Sin perfil la cuenta es inútil: se revierte para no dejar huérfanos.
    await admin.auth.admin.deleteUser(creado.user.id)
    return { error: `No se pudo crear el perfil: ${ePerfil.message}` }
  }

  revalidatePath('/admin/perfiles')
  return { ok: `Perfil de ${nombre} creado como ${rol}.` }
}

export async function alternarActivo(formulario: FormData) {
  await exigirRol(['admin'])
  const id = Number(formulario.get('id'))
  const activo = String(formulario.get('activo')) === 'true'
  const db = clienteServidor()
  await db.from('perfiles').update({ activo: !activo }).eq('id', id)
  revalidatePath('/admin/perfiles')
}
