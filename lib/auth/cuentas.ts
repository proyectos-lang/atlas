import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Rol } from './alcance'

/**
 * Alta de una cuenta de acceso: usuario en Supabase Auth + su perfil.
 *
 * Lo usan la pantalla de perfiles y la creación de grupos, que permite dar
 * de alta al docente sin salir del formulario. Ambos sitios deben exigir
 * rol de administrador ANTES de llamar aquí: esta función no lo comprueba.
 */

export interface DatosCuenta {
  nombre: string
  email: string
  password: string
  rol: Rol
  universidadId?: number | null
  programaId?: number | null
  cursoId?: number | null
  grupoId?: number | null
  usuarioId?: number | null
  modulos?: string[] | null
}

function clienteAuthAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

/** Validación común a cualquier alta: lo que no depende del rol. */
export function validarCredenciales(
  nombre: string, email: string, password: string
): string | null {
  if (!nombre || !email || !password) return 'Nombre, correo y contraseña son obligatorios.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'El correo no tiene un formato válido.'
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  return null
}

export async function crearCuenta(
  d: DatosCuenta
): Promise<{ perfilId: number; authUserId: string } | { error: string }> {
  const admin = clienteAuthAdmin()

  const { data: creado, error: eAuth } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
  })
  if (eAuth || !creado.user) {
    const msg = eAuth?.message ?? 'desconocido'
    if (/already|registered|exists/i.test(msg)) {
      return { error: `Ya existe una cuenta con el correo ${d.email}.` }
    }
    return { error: `No se pudo crear la cuenta: ${msg}` }
  }

  const db = clienteServidor()
  const { data, error: ePerfil } = await db.from('perfiles').insert({
    auth_user_id: creado.user.id,
    nombre: d.nombre,
    email: d.email,
    rol: d.rol,
    universidad_id: d.universidadId ?? null,
    programa_id: d.programaId ?? null,
    curso_id: d.cursoId ?? null,
    grupo_id: d.grupoId ?? null,
    usuario_id: d.usuarioId ?? null,
    activo: true,
    modulos: d.modulos ?? null,
  }).select('id').single()

  if (ePerfil || !data) {
    // Sin perfil la cuenta es inútil: se revierte para no dejar huérfanos.
    await admin.auth.admin.deleteUser(creado.user.id)
    return { error: `No se pudo crear el perfil: ${ePerfil?.message ?? 'desconocido'}` }
  }

  return { perfilId: Number(data.id), authUserId: creado.user.id }
}

/** Deshace un alta, para cuando lo que venía después falló. */
export async function revertirCuenta(perfilId: number, authUserId: string): Promise<void> {
  const db = clienteServidor()
  await db.from('perfiles').delete().eq('id', perfilId)
  await clienteAuthAdmin().auth.admin.deleteUser(authUserId)
}
