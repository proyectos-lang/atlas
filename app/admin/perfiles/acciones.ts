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

/**
 * Módulos enviados por el formulario.
 *
 * Devuelve `null` cuando el formulario no traía el selector (perfil sin
 * personalizar, usa los de su rol) y `[]` cuando el administrador
 * desmarcó todo. Confundir ambos casos haría que quitar todos los módulos
 * devolviera silenciosamente los del rol.
 */
function modulosDelFormulario(formulario: FormData): string[] | null {
  if (!formulario.get('modulos_presente')) return null

  const rutas = formulario
    .getAll('modulos')
    .map((v) => String(v).trim())
    .filter((r) => /^\/[A-Za-z0-9/_-]{1,99}$/.test(r))

  return [...new Set(rutas)]
}

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
  const programaId = nuloOEntero(formulario.get('programa_id'))
  const cursoId = nuloOEntero(formulario.get('curso_id'))
  const grupoId = nuloOEntero(formulario.get('grupo_id'))
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
    programa_id: programaId,
    curso_id: cursoId,
    grupo_id: grupoId,
    usuario_id: usuarioId,
    activo: true,
    modulos: modulosDelFormulario(formulario),
  })

  if (ePerfil) {
    // Sin perfil la cuenta es inútil: se revierte para no dejar huérfanos.
    await admin.auth.admin.deleteUser(creado.user.id)
    return { error: `No se pudo crear el perfil: ${ePerfil.message}` }
  }

  revalidatePath('/admin/perfiles')
  return { ok: `Perfil de ${nombre} creado como ${rol}.` }
}

/**
 * Cambia los módulos visibles de un perfil existente.
 *
 * Sólo toca qué PANTALLAS ve: el alcance de datos no se modifica aquí y
 * sigue decidiendo qué información aparece dentro de cada una.
 */
export async function guardarModulos(
  _previo: EstadoPerfil,
  formulario: FormData
): Promise<EstadoPerfil> {
  const { perfil } = await exigirRol(['admin'])

  const id = Number(formulario.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { error: 'Perfil no válido.' }

  const modulos = modulosDelFormulario(formulario)
  if (modulos === null) return { error: 'No se recibió la selección de módulos.' }

  // Un administrador que se quita a sí mismo la administración no podría
  // volver a entrar a esta pantalla para deshacerlo.
  if (id === perfil.id && !modulos.some((m) => m === '/admin' || m.startsWith('/admin/'))) {
    return {
      error:
        'No puedes quitarte a ti mismo el módulo de Administración: ' +
        'perderías el acceso a esta pantalla y nadie podría devolvértelo desde aquí.',
    }
  }

  const db = clienteServidor()
  const { error } = await db.from('perfiles').update({ modulos }).eq('id', id)

  if (error) {
    if (error.code === 'PGRST204' || error.code === '42703') {
      return {
        error:
          'Falta la columna atlas.perfiles.modulos. Aplica la migración ' +
          'supabase/migraciones/07_permisos_modulos.sql desde el SQL Editor.',
      }
    }
    return { error: `No se pudieron guardar los módulos: ${error.message}` }
  }

  revalidatePath('/admin/perfiles')
  revalidatePath('/', 'layout')
  return { ok: `Módulos actualizados (${modulos.length}).` }
}

export async function alternarActivo(formulario: FormData) {
  await exigirRol(['admin'])
  const id = Number(formulario.get('id'))
  const activo = String(formulario.get('activo')) === 'true'
  const db = clienteServidor()
  await db.from('perfiles').update({ activo: !activo }).eq('id', id)
  revalidatePath('/admin/perfiles')
}
