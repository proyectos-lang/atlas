'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'
import { generarSobreDimensiones } from '@/lib/ia/agente-dimensiones'

export interface EstadoIntervencion {
  error?: string
  ok?: string
}

const ESTADOS = ['Planificada', 'En curso', 'Completada', 'Descartada']

function texto(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}

function numeroONulo(v: FormDataEntryValue | null): number | null {
  const s = texto(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const AVISO =
  'Falta la capa de intervenciones. Aplica ' +
  'supabase/migraciones/16_intervenciones.sql desde el SQL Editor.'

/**
 * Registra una intervención didáctica.
 *
 * Puede nacer de una recomendación de la IA o de una decisión propia del
 * docente: el ciclo de mejora no empieza necesariamente en el agente.
 *
 * El valor del indicador se captura AL REGISTRAR, no al cerrar: tomarlo
 * después ya estaría contaminado por el efecto que se quiere medir.
 */
export async function registrarIntervencion(
  _previo: EstadoIntervencion,
  formulario: FormData
): Promise<EstadoIntervencion> {
  const { perfil } = await exigirRol(['docente', 'coordinador', 'asesor', 'admin'])

  const cursoId = numeroONulo(formulario.get('curso_id'))
  const usuarioId = numeroONulo(formulario.get('usuario_id'))
  const dimensionId = numeroONulo(formulario.get('dimension_id'))
  const indicadorId = numeroONulo(formulario.get('indicador_id'))
  const recomendacionId = numeroONulo(formulario.get('recomendacion_id'))
  const descripcion = texto(formulario.get('descripcion'))
  const estrategia = texto(formulario.get('estrategia'))
  const fechaInicio = texto(formulario.get('fecha_inicio'))

  if (cursoId === null) return { error: 'Selecciona el curso.' }
  if (descripcion.length < 10) {
    return { error: 'Describe la intervención con al menos 10 caracteres.' }
  }

  const db = clienteServidor()

  // Valor de partida del indicador, si se indicó cuál se ataca.
  let valorAntes: number | null = null
  if (indicadorId !== null) {
    const { data } = await db.rpc('kpi_evidencias', { p_semanas: null })
    const filas = (data ?? []) as Record<string, unknown>[]
    const propias = filas.filter(
      (f) =>
        Number(f.indicador_id) === indicadorId &&
        (usuarioId === null
          ? Number(f.curso_id) === cursoId
          : Number(f.usuario_id) === usuarioId)
    )
    if (propias.length > 0) {
      const suma = propias.reduce((t, f) => t + Number(f.valor ?? 0), 0)
      valorAntes = suma / propias.length
    }
  }

  const { data: creada, error } = await db
    .from('intervenciones')
    .insert({
      recomendacion_id: recomendacionId,
      curso_id: cursoId,
      usuario_id: usuarioId,
      dimension_id: dimensionId,
      indicador_id: indicadorId,
      descripcion,
      estrategia: estrategia || null,
      valor_antes: valorAntes,
      estado: 'Planificada',
      fecha_inicio: fechaInicio || null,
      registrado_por: perfil.id,
    })
    .select()
    .maybeSingle()

  if (error) {
    if (faltaMigracion(error.code)) return { error: AVISO }
    return { error: `No se pudo registrar: ${error.message}` }
  }

  // Marca como «Antes» las evidencias que ya existían del indicador
  // atacado. Sin esta separación no se puede medir el efecto: se
  // mezclarían los datos que motivaron la intervención con los que
  // deberían mostrar su resultado.
  if (creada && indicadorId !== null) {
    let q = db
      .from('evidencias')
      .update({ intervencion_id: Number(creada.id), momento: 'Antes' })
      .eq('indicador_id', indicadorId)
      .is('momento', null)

    q = usuarioId === null ? q.eq('curso_id', cursoId) : q.eq('usuario_id', usuarioId)
    await q
  }

  revalidatePath('/intervenciones')
  return {
    ok:
      `Intervención registrada.` +
      (valorAntes !== null
        ? ` Valor de partida: ${valorAntes.toFixed(1).replace('.', ',')} %.`
        : ' Sin indicador asociado, no se podrá medir su efecto.'),
  }
}

/** Cambia el estado de una intervención. */
export async function cambiarEstado(formulario: FormData) {
  await exigirRol(['docente', 'coordinador', 'asesor', 'admin'])

  const id = numeroONulo(formulario.get('id'))
  const estado = texto(formulario.get('estado'))
  if (id === null || !ESTADOS.includes(estado)) return

  const db = clienteServidor()
  const cambios: Record<string, unknown> = { estado }

  if (estado === 'Completada') {
    cambios.fecha_cierre = new Date().toISOString().slice(0, 10)
    cambios.medido_en = new Date().toISOString()
  }

  await db.from('intervenciones').update(cambios).eq('id', id)
  revalidatePath('/intervenciones')
}

/**
 * Marca como «Después» las evidencias posteriores a la intervención.
 *
 * Es el paso que permite comparar. Se hace explícito y no automático
 * porque sólo el docente sabe cuándo la intervención ya tuvo tiempo de
 * surtir efecto: marcarlas demasiado pronto mediría ruido.
 */
export async function cerrarMedicion(formulario: FormData) {
  await exigirRol(['docente', 'coordinador', 'asesor', 'admin'])

  const id = numeroONulo(formulario.get('id'))
  if (id === null) return

  const db = clienteServidor()
  const { data: iv } = await db
    .from('intervenciones')
    .select('curso_id, usuario_id, indicador_id, creado_en')
    .eq('id', id)
    .maybeSingle()

  if (!iv || iv.indicador_id == null) return

  let q = db
    .from('evidencias')
    .update({ intervencion_id: id, momento: 'Despues' })
    .eq('indicador_id', iv.indicador_id)
    .is('momento', null)
    .gt('fecha', String(iv.creado_en))

  q = iv.usuario_id == null
    ? q.eq('curso_id', Number(iv.curso_id))
    : q.eq('usuario_id', Number(iv.usuario_id))

  await q

  await db.from('intervenciones').update({
    estado: 'Completada',
    fecha_cierre: new Date().toISOString().slice(0, 10),
    medido_en: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/intervenciones')
}

/**
 * Genera recomendaciones sobre las dificultades que detectó la analítica.
 *
 * A diferencia del recomendador anterior, que trabajaba sobre índices
 * generales, este recibe la dimensión concreta y el patrón --individual o
 * del grupo-- ya clasificado por la analítica.
 */
export async function generarRecomendaciones(
  _previo: EstadoIntervencion,
  formulario: FormData
): Promise<EstadoIntervencion> {
  const { alcance } = await exigirRol(['asesor', 'admin', 'coordinador'])

  const usuarioId = numeroONulo(formulario.get('usuario_id'))

  try {
    const r = await generarSobreDimensiones(alcance, {
      usuarioId: usuarioId ?? undefined,
    })

    if (r.errores.length > 0 && r.generadas === 0) {
      return { error: r.errores[0] }
    }

    revalidatePath('/intervenciones')
    revalidatePath('/docente/revision')

    return {
      ok:
        `${r.generadas} recomendaciones generadas ` +
        `(${r.individuales} individuales, ${r.grupales} grupales).` +
        (r.errores.length > 0 ? ` ${r.errores.length} con error.` : ''),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar.' }
  }
}
