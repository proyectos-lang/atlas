'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'

export interface EstadoPerfilEgreso {
  error?: string
  ok?: string
}

/** Mismo mínimo que el check de la tabla (06_perfil_egreso.sql). */
const MINIMO = 20
const MAXIMO = 20000

/**
 * Guarda el perfil de egreso de un programa (una fila de universidades).
 *
 * Sólo admin: el perfil de egreso es el documento curricular del programa
 * y cambia el contexto con el que el agente redacta TODAS las
 * recomendaciones de ese programa.
 *
 * Es un upsert por universidad_id: la tabla tiene esa columna unique, así
 * que guardar dos veces reemplaza en vez de duplicar.
 */
export async function guardarPerfilEgreso(
  _previo: EstadoPerfilEgreso,
  formulario: FormData
): Promise<EstadoPerfilEgreso> {
  const { perfil } = await exigirRol(['admin'])

  const universidadId = Number(formulario.get('universidad_id'))
  if (!Number.isInteger(universidadId) || universidadId <= 0) {
    return { error: 'Selecciona un programa.' }
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

  // El programa debe existir y ser visible: sin esta comprobación, un id
  // inventado en el formulario insertaría una fila huérfana.
  const { data: universidad } = await db
    .from('universidades')
    .select('id')
    .eq('id', universidadId)
    .maybeSingle()

  if (!universidad) return { error: 'El programa indicado no existe.' }

  const { error } = await db
    .from('perfiles_egreso')
    .upsert(
      {
        universidad_id: universidadId,
        perfil_egreso: perfilEgreso,
        notas: notas || null,
        activo,
        actualizado_por: perfil.id,
      },
      { onConflict: 'universidad_id' }
    )

  if (error) {
    // PGRST205: PostgREST no encuentra la tabla en su caché de esquema.
    // 42P01: el propio Postgres dice que no existe.
    if (error.code === 'PGRST205' || error.code === '42P01') {
      return {
        error:
          'Falta la tabla atlas.perfiles_egreso. Aplica la migración ' +
          'supabase/migraciones/06_perfil_egreso.sql desde el SQL Editor.',
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
  await exigirRol(['admin'])

  const id = Number(formulario.get('id'))
  if (!Number.isInteger(id)) return

  const activo = String(formulario.get('activo')) === 'true'

  const db = clienteServidor()
  await db.from('perfiles_egreso').update({ activo: !activo }).eq('id', id)

  revalidatePath('/admin/perfil-egreso')
}
