import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

/**
 * Seguimiento de intervenciones.
 *
 * Cierra el ciclo del modelo:
 *
 *   Datos → Analítica → Recomendación → Intervención
 *     → Nueva evidencia → Nueva analítica
 *
 * Una intervención puede nacer de una recomendación de la IA o de una
 * decisión propia del docente: el ciclo de mejora no empieza
 * necesariamente en el agente.
 */

type Fila = Record<string, unknown>

export type EstadoIntervencion =
  | 'Planificada' | 'En curso' | 'Completada' | 'Descartada'

export interface Intervencion {
  id: number
  recomendacionId: number | null
  cursoId: number
  grupoId: number | null
  usuarioId: number | null
  dimensionId: number | null
  indicadorId: number | null
  descripcion: string
  estrategia: string | null
  valorAntes: number | null
  valorDespues: number | null
  estado: EstadoIntervencion
  fechaInicio: string | null
  fechaCierre: string | null
  observaciones: string | null
  creadoEn: string
}

export interface EfectoIntervencion {
  intervencionId: number
  indicadorId: number
  indicador: string
  dimension: string
  estudiantes: number
  valorAntes: number | null
  valorDespues: number | null
  cambio: number | null
  evidenciasAntes: number
  evidenciasDespues: number
}

/** Estrategias didácticas reconocibles, para el selector. */
export const ESTRATEGIAS: readonly string[] = [
  'Aprendizaje basado en problemas',
  'Estudio de casos',
  'Debate argumentativo',
  'Reto de programación',
  'Trabajo colaborativo',
  'Actividad de argumentación',
  'Estrategia de autorregulación',
  'Coevaluación',
  'Actividad diferenciada',
  'Tutoría focalizada',
  'Rediseño de la secuencia didáctica',
]

export async function intervenciones(
  alcance: Alcance,
  filtro: { estado?: EstadoIntervencion; limite?: number } = {}
): Promise<Intervencion[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  let q = db
    .from('intervenciones')
    .select(
      'id, recomendacion_id, curso_id, grupo_id, usuario_id, dimension_id, ' +
      'indicador_id, descripcion, estrategia, valor_antes, valor_despues, ' +
      'estado, fecha_inicio, fecha_cierre, observaciones, creado_en'
    )
    .order('creado_en', { ascending: false })
    .limit(filtro.limite ?? 100)

  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)
  if (filtro.estado) q = q.eq('estado', filtro.estado)

  const { data, error } = await q
  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`intervenciones: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[])
    // El alcance por usuario no se aplica en la consulta porque una
    // intervención grupal tiene usuario_id nulo: filtrarla por `in`
    // la dejaría fuera, y es justo la que el docente necesita ver.
    .filter((i) =>
      alcance.usuarioIds === null ||
      i.usuario_id == null ||
      alcance.usuarioIds.includes(Number(i.usuario_id))
    )
    .map((i) => ({
      id: Number(i.id),
      recomendacionId: i.recomendacion_id == null ? null : Number(i.recomendacion_id),
      cursoId: Number(i.curso_id),
      grupoId: i.grupo_id == null ? null : Number(i.grupo_id),
      usuarioId: i.usuario_id == null ? null : Number(i.usuario_id),
      dimensionId: i.dimension_id == null ? null : Number(i.dimension_id),
      indicadorId: i.indicador_id == null ? null : Number(i.indicador_id),
      descripcion: String(i.descripcion),
      estrategia: i.estrategia == null ? null : String(i.estrategia),
      valorAntes: i.valor_antes == null ? null : Number(i.valor_antes),
      valorDespues: i.valor_despues == null ? null : Number(i.valor_despues),
      estado: String(i.estado) as EstadoIntervencion,
      fechaInicio: i.fecha_inicio == null ? null : String(i.fecha_inicio),
      fechaCierre: i.fecha_cierre == null ? null : String(i.fecha_cierre),
      observaciones: i.observaciones == null ? null : String(i.observaciones),
      creadoEn: String(i.creado_en),
    }))
}

/**
 * Efecto medido de una intervención.
 *
 * No decide si «funcionó»: devuelve el cambio y cuántas evidencias lo
 * sostienen de cada lado. Un salto de 20 puntos medido con una sola
 * evidencia posterior no dice lo mismo que uno de 5 con quince.
 */
export async function efecto(intervencionId: number): Promise<EfectoIntervencion[]> {
  const db = clienteServidor()
  const { data, error } = await db.rpc('efecto_intervencion', {
    p_intervencion_id: intervencionId,
  })

  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`efecto_intervencion: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[]).map((e) => ({
    intervencionId: Number(e.intervencion_id),
    indicadorId: Number(e.indicador_id),
    indicador: String(e.indicador),
    dimension: String(e.dimension),
    estudiantes: Number(e.estudiantes),
    valorAntes: e.valor_antes == null ? null : Number(e.valor_antes),
    valorDespues: e.valor_despues == null ? null : Number(e.valor_despues),
    cambio: e.cambio == null ? null : Number(e.cambio),
    evidenciasAntes: Number(e.evidencias_antes),
    evidenciasDespues: Number(e.evidencias_despues),
  }))
}

/** ¿Está aplicada la migración 16? Para avisar en la interfaz. */
export async function intervencionesDisponibles(): Promise<boolean> {
  const db = clienteServidor()
  const { error } = await db
    .from('intervenciones').select('id', { head: true, count: 'exact' })
  return !error
}
