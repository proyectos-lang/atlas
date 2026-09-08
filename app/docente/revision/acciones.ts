'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import { INDICE_DE_COMPETENCIA } from '@/lib/kpi/catalogo'

/**
 * Flujo de revisión (§10.4).
 *
 * El docente Aprueba, Rechaza o marca como Implementada.
 *   · al aprobar   -> se sella fecha_respuesta
 *   · al rechazar  -> se sella fecha_respuesta
 *   · al implementar -> se sellan fecha_aplicacion y valor_antes
 *
 * valor_antes guarda el índice de la competencia en ese momento; un proceso
 * de cierre llena valor_despues. Ese par alimenta la Efectividad de la
 * Intervención Adaptativa, que hoy no se puede calcular por falta de registro.
 */

/** Índice actual de la competencia, para sellar valor_antes. */
async function indiceActual(
  usuarioId: number | null,
  cursoId: number,
  competencia: string
): Promise<number | null> {
  const db = clienteServidor()
  const { data, error } = await db.rpc('kpi_indice', { p_semanas: null })
  if (error) return null

  const clave = (INDICE_DE_COMPETENCIA[competencia] ?? '').toLowerCase()
  if (!clave) return null

  const filas = (data ?? []).filter((f: Record<string, unknown>) =>
    usuarioId !== null
      ? Number(f.usuario_id) === usuarioId
      : Number(f.curso_id) === cursoId
  )
  if (filas.length === 0) return null

  const suma = filas.reduce(
    (t: number, f: Record<string, unknown>) => t + Number(f[clave] ?? 0), 0
  )
  return Math.round((suma / filas.length) * 10) / 10
}

async function cargar(id: number) {
  const db = clienteServidor()
  const { data, error } = await db
    .from('recomendaciones_ia')
    .select('id, curso_id, usuario_id, competencia, estado')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error('Recomendación no encontrada')
  return data
}

/** Sólo el docente de ese curso (o un admin) puede revisarla. */
async function verificarAcceso(cursoId: number) {
  const { perfil } = await exigirRol(['docente', 'admin', 'coordinador'])
  if (perfil.rol !== 'admin' && perfil.cursoId !== null && perfil.cursoId !== cursoId) {
    throw new Error('Esa recomendación no pertenece a tu curso')
  }
  return perfil
}

export async function aprobar(formulario: FormData) {
  const id = Number(formulario.get('id'))
  const r = await cargar(id)
  await verificarAcceso(Number(r.curso_id))

  const db = clienteServidor()
  await db.from('recomendaciones_ia').update({
    estado: 'Aprobada',
    fecha_respuesta: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/docente/revision')
  revalidatePath('/asesor')
}

export async function rechazar(formulario: FormData) {
  const id = Number(formulario.get('id'))
  const r = await cargar(id)
  await verificarAcceso(Number(r.curso_id))

  const db = clienteServidor()
  await db.from('recomendaciones_ia').update({
    estado: 'Rechazada',
    fecha_respuesta: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/docente/revision')
  revalidatePath('/asesor')
}

export async function implementar(formulario: FormData) {
  const id = Number(formulario.get('id'))
  const r = await cargar(id)
  await verificarAcceso(Number(r.curso_id))

  // Se sella el valor de la competencia ANTES de la intervención.
  const antes = await indiceActual(
    r.usuario_id === null ? null : Number(r.usuario_id),
    Number(r.curso_id),
    String(r.competencia)
  )

  const ahora = new Date().toISOString()
  const db = clienteServidor()
  await db.from('recomendaciones_ia').update({
    estado: 'Implementada',
    aplicada: true,
    fecha_respuesta: r.estado === 'Pendiente de revisión docente' ? ahora : undefined,
    fecha_aplicacion: ahora,
    valor_antes: antes,
  }).eq('id', id)

  revalidatePath('/docente/revision')
  revalidatePath('/asesor')
}

/**
 * Cierre del período: llena valor_despues con el índice actual de cada
 * recomendación implementada. Es lo que completa el par antes/después.
 */
export async function cerrarPeriodo(): Promise<{ cerradas: number }> {
  await exigirRol(['admin', 'coordinador'])
  const db = clienteServidor()

  const { data } = await db
    .from('recomendaciones_ia')
    .select('id, curso_id, usuario_id, competencia')
    .eq('estado', 'Implementada')
    .is('valor_despues', null)
    .not('valor_antes', 'is', null)

  let cerradas = 0
  for (const r of data ?? []) {
    const despues = await indiceActual(
      r.usuario_id === null ? null : Number(r.usuario_id),
      Number(r.curso_id),
      String(r.competencia)
    )
    if (despues === null) continue
    await db.from('recomendaciones_ia')
      .update({ valor_despues: despues })
      .eq('id', r.id)
    cerradas++
  }

  revalidatePath('/asesor')
  return { cerradas }
}
