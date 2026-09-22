import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

/**
 * Las cuatro funciones de analítica del modelo.
 *
 *   Descriptiva   ¿qué está ocurriendo?
 *   Diagnóstica   ¿qué dificultades presenta el estudiante o el grupo?
 *   Predictiva    ¿qué patrones anticipan bajo logro?
 *   Prescriptiva  ¿qué acción didáctica conviene?   → lib/ia/agente.ts
 *
 * Todo se calcula sobre INDICADORES, no sobre calificaciones: es lo que
 * permite decir «falla en depuración» en vez de «tiene 60».
 */

type Fila = Record<string, unknown>

export type TipoDiagnostico =
  | 'Dificultad individual'
  | 'Dificultad del grupo'
  | 'En desarrollo'
  | 'Logrado'
  | 'Fortaleza destacada'

export type NivelRiesgo = 'Alto' | 'Medio' | 'Bajo'

export interface FilaDescriptiva {
  usuarioId: number
  cursoId: number
  competenciaId: number
  competencia: string
  dimensionId: number
  dimension: string
  valor: number
  indicadores: number
  evidencias: number
}

export interface FilaDiagnostica {
  usuarioId: number
  cursoId: number
  competencia: string
  dimensionId: number
  dimension: string
  valor: number
  mediaGrupo: number
  /** Puntos que faltan para el nivel Alto. Negativo si ya lo superó. */
  brechaMeta: number
  /** Distancia respecto al grupo. Negativo = por debajo. */
  brechaGrupo: number
  evidencias: number
  tipo: TipoDiagnostico
}

export interface FilaPredictiva {
  usuarioId: number
  cursoId: number
  dimensionesBajas: number
  dimensionesTotales: number
  mediaGeneral: number
  minimo: number
  sinEvidencia: number
  /**
   * Proporción de dimensiones con evidencia, de 0 a 1.
   *
   * Dice sobre cuánta base se afirma el riesgo: un «Alto» con dos
   * dimensiones medidas de veinticinco no es lo mismo que uno con veinte.
   */
  cobertura: number | null
  riesgo: NivelRiesgo
  /** Por qué se marcó así. Una alerta sin explicación no es accionable. */
  senales: string[]
}

/** Aplica el alcance a cualquier fila que traiga curso y usuario. */
function enAlcance(alcance: Alcance, f: Fila): boolean {
  return (
    (alcance.cursoIds === null || alcance.cursoIds.includes(Number(f.curso_id))) &&
    (alcance.usuarioIds === null || alcance.usuarioIds.includes(Number(f.usuario_id)))
  )
}

export async function descriptiva(
  alcance: Alcance,
  semanas: number[] | null = null
): Promise<FilaDescriptiva[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const { data, error } = await db.rpc('analitica_descriptiva', { p_semanas: semanas })

  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`analitica_descriptiva: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((f) => enAlcance(alcance, f))
    .map((f) => ({
      usuarioId: Number(f.usuario_id),
      cursoId: Number(f.curso_id),
      competenciaId: Number(f.competencia_id),
      competencia: String(f.competencia),
      dimensionId: Number(f.dimension_id),
      dimension: String(f.dimension),
      valor: Number(f.valor),
      indicadores: Number(f.indicadores),
      evidencias: Number(f.evidencias),
    }))
}

export async function diagnostica(
  alcance: Alcance,
  semanas: number[] | null = null
): Promise<FilaDiagnostica[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const { data, error } = await db.rpc('analitica_diagnostica', { p_semanas: semanas })

  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`analitica_diagnostica: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((f) => enAlcance(alcance, f))
    .map((f) => ({
      usuarioId: Number(f.usuario_id),
      cursoId: Number(f.curso_id),
      competencia: String(f.competencia),
      dimensionId: Number(f.dimension_id),
      dimension: String(f.dimension),
      valor: Number(f.valor),
      mediaGrupo: Number(f.media_grupo),
      brechaMeta: Number(f.brecha_meta),
      brechaGrupo: Number(f.brecha_grupo),
      evidencias: Number(f.evidencias),
      tipo: String(f.tipo) as TipoDiagnostico,
    }))
}

export async function predictiva(
  alcance: Alcance,
  semanas: number[] | null = null
): Promise<FilaPredictiva[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const { data, error } = await db.rpc('analitica_predictiva', { p_semanas: semanas })

  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`analitica_predictiva: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((f) => enAlcance(alcance, f))
    .map((f) => ({
      usuarioId: Number(f.usuario_id),
      cursoId: Number(f.curso_id),
      dimensionesBajas: Number(f.dimensiones_bajas),
      dimensionesTotales: Number(f.dimensiones_totales),
      mediaGeneral: Number(f.media_general),
      minimo: Number(f.minimo),
      sinEvidencia: Number(f.sin_evidencia),
      cobertura: f.cobertura == null ? null : Number(f.cobertura),
      riesgo: String(f.riesgo) as NivelRiesgo,
      senales: Array.isArray(f.senales) ? f.senales.map(String) : [],
    }))
}

/**
 * Dificultades del GRUPO, no de una persona.
 *
 * Una dimensión baja en casi todo el curso señala un problema de
 * enseñanza: la intervención es para la clase, no para un estudiante.
 * Sin esta distinción se corre el riesgo de tratar como dificultad
 * individual lo que es una carencia de la secuencia didáctica.
 */
export interface DificultadGrupal {
  cursoId: number
  competencia: string
  dimensionId: number
  dimension: string
  media: number
  afectados: number
  total: number
  proporcion: number
}

export async function dificultadesGrupales(
  alcance: Alcance,
  semanas: number[] | null = null,
  umbralProporcion = 0.4
): Promise<DificultadGrupal[]> {
  const filas = await diagnostica(alcance, semanas)
  if (filas.length === 0) return []

  const porDimension = new Map<string, FilaDiagnostica[]>()
  for (const f of filas) {
    const k = `${f.cursoId}·${f.dimensionId}`
    porDimension.set(k, [...(porDimension.get(k) ?? []), f])
  }

  const salida: DificultadGrupal[] = []

  for (const grupo of porDimension.values()) {
    const bajos = grupo.filter((f) => f.valor < 60)
    const proporcion = bajos.length / grupo.length

    if (proporcion <= umbralProporcion) continue

    salida.push({
      cursoId: grupo[0].cursoId,
      competencia: grupo[0].competencia,
      dimensionId: grupo[0].dimensionId,
      dimension: grupo[0].dimension,
      media: grupo.reduce((t, f) => t + f.valor, 0) / grupo.length,
      afectados: bajos.length,
      total: grupo.length,
      proporcion,
    })
  }

  // Lo más extendido primero: es donde una intervención rinde más.
  return salida.sort((a, b) => b.proporcion - a.proporcion)
}

/** ¿Hay analítica que mostrar? Distingue «sin datos» de «sin migrar». */
export async function analiticaDisponible(): Promise<boolean> {
  const db = clienteServidor()
  const { error } = await db.rpc('analitica_descriptiva', { p_semanas: null })
  return !error
}
