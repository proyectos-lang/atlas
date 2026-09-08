'use server'

import { revalidatePath } from 'next/cache'
import { exigirRol } from '@/lib/auth/sesion'
import { aplicarFiltros } from '@/lib/auth/alcance'
import { generarRecomendaciones } from '@/lib/ia/agente'
import { clienteServidor } from '@/lib/supabase/servidor'

export interface EstadoGeneracion {
  ok?: string
  error?: string
}

/**
 * Disparo manual desde la página del Asesor Pedagógico.
 * Alcance: curso completo o un estudiante puntual.
 */
export async function generar(
  _previo: EstadoGeneracion,
  formulario: FormData
): Promise<EstadoGeneracion> {
  const { alcance } = await exigirRol(['asesor', 'admin', 'coordinador'])

  const cursoCodigo = String(formulario.get('curso') ?? '').trim()
  const estudianteCodigo = String(formulario.get('estudiante') ?? '').trim()

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: 'Falta ANTHROPIC_API_KEY en el entorno del servidor.' }
  }

  const db = clienteServidor()
  let ambito = alcance
  let usuarioId: number | undefined

  if (cursoCodigo) {
    const { data } = await db.from('cursos').select('id').eq('codigo', cursoCodigo).maybeSingle()
    if (!data) return { error: 'Curso no encontrado.' }
    ambito = aplicarFiltros(ambito, { cursoIds: [Number(data.id)] })
  }

  if (estudianteCodigo) {
    const { data } = await db.from('usuarios').select('id').eq('codigo', estudianteCodigo).maybeSingle()
    if (!data) return { error: 'Estudiante no encontrado.' }
    usuarioId = Number(data.id)
  }

  try {
    const r = await generarRecomendaciones(ambito, {
      usuarioId,
      incluirGrupales: usuarioId === undefined,
    })

    revalidatePath('/asesor')
    revalidatePath('/docente/revision')

    if (r.generadas === 0) {
      return {
        ok: r.errores.length
          ? `Sin recomendaciones nuevas. ${r.errores[0]}`
          : 'No hay competencias por debajo del nivel Alto en este ámbito.',
      }
    }
    return {
      ok:
        `${r.generadas} recomendaciones generadas ` +
        `(${r.individuales} individuales, ${r.grupales} grupales) · ` +
        `${r.tokens.toLocaleString('es')} tokens · pendientes de tu revisión.` +
        (r.errores.length ? ` ${r.errores.length} con error.` : ''),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error al generar.' }
  }
}
