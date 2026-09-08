'use server'

import { revalidatePath } from 'next/cache'
import { exigirRol } from '@/lib/auth/sesion'
import { aplicarFiltros } from '@/lib/auth/alcance'
import { generarRecomendaciones } from '@/lib/ia/agente'
import { clienteServidor } from '@/lib/supabase/servidor'

export interface EstadoGeneracion {
  ok?: string
  error?: string
  detalle?: string[]
}

/**
 * Genera recomendaciones para el ámbito elegido y las guarda en
 * atlas.recomendaciones_ia con estado 'Pendiente de revisión docente'.
 *
 * El alcance del perfil manda: la selección de la interfaz se intersecta
 * con él, así que pedir una universidad ajena no devuelve nada.
 */
export async function generar(
  _previo: EstadoGeneracion,
  formulario: FormData
): Promise<EstadoGeneracion> {
  const { alcance } = await exigirRol(['asesor', 'admin', 'coordinador'])

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'Falta ANTHROPIC_API_KEY en el entorno del servidor.' }
  }

  const universidad = String(formulario.get('universidad') ?? '').trim()
  const curso = String(formulario.get('curso') ?? '').trim()
  const destino = String(formulario.get('destino') ?? 'curso')
  const estudiante = String(formulario.get('estudiante') ?? '').trim()

  if (destino === 'estudiante' && !estudiante) {
    return { error: 'Selecciona un estudiante de la lista.' }
  }

  const db = clienteServidor()
  let ambito = alcance

  if (universidad) {
    const { data } = await db.from('universidades').select('id').eq('codigo', universidad).maybeSingle()
    if (!data) return { error: 'Universidad no encontrada.' }
    ambito = aplicarFiltros(ambito, { universidadIds: [Number(data.id)] })
  }

  if (curso) {
    const { data } = await db.from('cursos').select('id').eq('codigo', curso).maybeSingle()
    if (!data) return { error: 'Curso no encontrado.' }
    ambito = aplicarFiltros(ambito, { cursoIds: [Number(data.id)] })
  }

  let usuarioId: number | undefined
  if (destino === 'estudiante') {
    const { data } = await db.from('usuarios').select('id, curso_id').eq('codigo', estudiante).maybeSingle()
    if (!data) return { error: 'Estudiante no encontrado.' }
    // Se restringe también por curso: así el alcance sigue mandando.
    ambito = aplicarFiltros(ambito, { cursoIds: [Number(data.curso_id)] })
    usuarioId = Number(data.id)
  }

  try {
    const r = await generarRecomendaciones(ambito, {
      usuarioId,
      incluirGrupales: usuarioId === undefined,
    })

    revalidatePath('/recomendador')
    revalidatePath('/asesor')
    revalidatePath('/docente/revision')

    if (r.generadas === 0) {
      return {
        ok: r.errores.length
          ? 'No se generó ninguna recomendación.'
          : 'No hay competencias por debajo del nivel Alto en este ámbito: no hace falta recomendar nada.',
        detalle: r.errores.slice(0, 5),
      }
    }

    const partes = [`${r.individuales} individuales`]
    if (r.grupales > 0) partes.push(`${r.grupales} grupales`)

    return {
      ok:
        `${r.generadas} recomendaciones guardadas (${partes.join(', ')}), ` +
        `pendientes de revisión docente. ${r.tokens.toLocaleString('es')} tokens consumidos.`,
      detalle: r.errores.length ? [`${r.errores.length} con error:`, ...r.errores.slice(0, 4)] : [],
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar recomendaciones.' }
  }
}
