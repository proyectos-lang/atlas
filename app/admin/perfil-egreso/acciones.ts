'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

export interface EstadoPerfilEgreso {
  error?: string
  ok?: string
}

/** Mismo mínimo que el check de la tabla (06_perfil_egreso.sql). */
const MINIMO = 20
const MAXIMO = 20000

/**
 * Guarda el perfil de egreso de un PROGRAMA.
 *
 * Hasta la migración 18 se colgaba de la universidad, porque en la 06
 * universidad y programa eran la misma fila. El usuario lo vio como
 * «los nombres de los programas no corresponden»: la pantalla leía una
 * columna de texto obsoleta y no la tabla de programas.
 *
 * Es un upsert por programa_id. `universidad_id` se deriva del programa
 * --la tabla la exige-- en vez de pedirla aparte, para que ambas no
 * puedan quedar incoherentes.
 */
export async function guardarPerfilEgreso(
  _previo: EstadoPerfilEgreso,
  formulario: FormData
): Promise<EstadoPerfilEgreso> {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador'], '/admin/perfil-egreso')

  const programaId = Number(formulario.get('programa_id'))
  if (!Number.isInteger(programaId) || programaId <= 0) {
    return { error: 'Selecciona un programa.' }
  }

  // Un coordinador sólo configura el perfil de su programa.
  if (alcance.programaIds !== null && !alcance.programaIds.includes(programaId)) {
    return { error: 'Ese programa está fuera de tu alcance.' }
  }

  const perfilEgreso = String(formulario.get('perfil_egreso') ?? '').trim()
  const notas = String(formulario.get('notas') ?? '').trim()
  const activo = formulario.get('activo') !== null

  if (perfilEgreso.length < MINIMO) {
    return {
      error: `El perfil de egreso debe tener al menos ${MINIMO} caracteres. ` +
        'Un texto vacío daría al agente un contexto en blanco sin que nadie lo note.',
    }
  }
  if (perfilEgreso.length > MAXIMO) {
    return { error: `El perfil de egreso supera los ${MAXIMO} caracteres.` }
  }

  const db = clienteServidor()

  const { data: programa } = await db
    .from('programas')
    .select('id, universidad_id')
    .eq('id', programaId)
    .maybeSingle()

  if (!programa) return { error: 'El programa indicado no existe.' }

  const { error } = await db
    .from('perfiles_egreso')
    .upsert(
      {
        programa_id: programaId,
        universidad_id: programa.universidad_id,
        perfil_egreso: perfilEgreso,
        notas: notas || null,
        activo,
        actualizado_por: perfil.id,
      },
      { onConflict: 'programa_id' }
    )

  if (error) {
    if (faltaMigracion(error.code)) {
      return {
        error:
          'Falta la tabla atlas.perfiles_egreso. Aplica la migración ' +
          'supabase/migraciones/06_perfil_egreso.sql desde el SQL Editor.',
      }
    }
    // La unique por universidad de la migración 06 sigue en pie: una
    // universidad con dos programas sólo admite un perfil hasta la 18.
    if (error.code === '23505' && /universidad/.test(error.message)) {
      return {
        error:
          'Esta universidad ya tiene un perfil de egreso en otro programa. ' +
          'Aplica supabase/migraciones/18_edicion_y_egreso_por_programa.sql ' +
          'para permitir uno por programa.',
      }
    }
    return { error: `No se pudo guardar: ${error.message}` }
  }

  revalidatePath('/admin/perfil-egreso')
  return { ok: 'Perfil de egreso guardado. El agente ya lo usará como contexto.' }
}

/**
 * Activa o desactiva un perfil de egreso sin borrarlo.
 * Un perfil inactivo se conserva pero no entra al contexto del agente.
 */
export async function alternarActivoEgreso(formulario: FormData) {
  await exigirRol(['admin', 'coordinador'], '/admin/perfil-egreso')

  const id = Number(formulario.get('id'))
  if (!Number.isInteger(id)) return

  const activo = String(formulario.get('activo')) === 'true'

  const db = clienteServidor()
  await db.from('perfiles_egreso').update({ activo: !activo }).eq('id', id)

  revalidatePath('/admin/perfil-egreso')
}
