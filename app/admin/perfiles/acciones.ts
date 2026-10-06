'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import type { Rol } from '@/lib/auth/alcance'
import { exigirRol } from '@/lib/auth/sesion'
import { crearCuenta, validarCredenciales } from '@/lib/auth/cuentas'

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
 *
 * Un docente NO necesita curso ni grupo al crearse. Antes los exigía, y
 * eso cerraba un círculo: el grupo pedía un docente que aún no existía y
 * el docente pedía un curso o grupo que aún no existía. Ahora el docente
 * obtiene su acceso de los grupos que se le asignan (grupos.docente_id).
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

  const invalido = validarCredenciales(nombre, email, password)
  if (invalido) return { error: invalido }
  if (!ROLES.includes(rol)) return { error: 'Rol no válido.' }

  const universidadId = nuloOEntero(formulario.get('universidad_id'))
  const programaId = nuloOEntero(formulario.get('programa_id'))
  let cursoId = nuloOEntero(formulario.get('curso_id'))
  const grupoId = nuloOEntero(formulario.get('grupo_id'))
  const usuarioId = nuloOEntero(formulario.get('usuario_id'))

  // Coherencia del alcance: un rol restringido sin su ámbito no vería nada.
  if ((rol === 'coordinador' || rol === 'asesor') && universidadId === null) {
    return { error: 'Un coordinador o asesor necesita una universidad asignada.' }
  }
  if (rol === 'estudiante' && usuarioId === null) {
    return { error: 'Un estudiante necesita un registro de estudiante asignado.' }
  }

  // Un grupo determina su curso: si viene grupo, el curso se deriva de él
  // y no puede contradecirlo.
  if (rol === 'docente' && grupoId !== null) {
    const db = clienteServidor()
    const { data: grupo } = await db
      .from('grupos').select('curso_id').eq('id', grupoId).maybeSingle()
    if (!grupo) return { error: 'El grupo indicado no existe.' }
    if (cursoId !== null && cursoId !== Number(grupo.curso_id)) {
      return { error: 'Ese grupo no pertenece al curso elegido.' }
    }
    cursoId = Number(grupo.curso_id)
  }

  // Para un docente el grupo se registra SÓLO como responsable del grupo
  // (grupos.docente_id), no en su perfil: así hay una única fuente de
  // verdad y reasignar el grupo a otro docente le retira el acceso a este.
  const porGrupo = rol === 'docente' && grupoId !== null
  const r = await crearCuenta({
    nombre, email, password, rol,
    universidadId, programaId,
    cursoId: porGrupo ? null : cursoId,
    grupoId: porGrupo ? null : grupoId,
    usuarioId,
    modulos: modulosDelFormulario(formulario),
  })
  if ('error' in r) return { error: r.error }

  if (porGrupo) {
    const db = clienteServidor()
    await db.from('grupos').update({ docente_id: r.perfilId }).eq('id', grupoId)
    revalidatePath('/admin/jerarquia')
  }

  revalidatePath('/admin/perfiles')
  return {
    ok: rol === 'docente' && cursoId === null && !porGrupo
      ? `Docente ${nombre} creado. Asígnalo a sus grupos (Jerarquía o Asistente de creación) para que vea sus estudiantes.`
      : `Perfil de ${nombre} creado como ${rol}.`,
  }
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
