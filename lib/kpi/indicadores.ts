import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'

/**
 * Capa tipada sobre las funciones de Postgres del motor.
 *
 * El cálculo pesado (por estudiante, con truncamiento y prorrateo) vive en
 * SQL; aquí sólo se filtra por alcance y se agrega. Como en el resto del
 * sistema, el Alcance es obligatorio y se aplica en el servidor.
 */

export interface Filtros {
  semanas?: number[] | null
  competencia?: string | null
  ilo?: string | null
  tipoActividad?: string | null
}

export interface IndicesEstudiante {
  usuarioId: number
  cursoId: number
  universidadId: number
  ite: number; iau: number; icom: number
  ipc: number; irp: number; ctg: number
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const media = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : null


/**
 * Traduce las dimensiones de jerarquía a una lista de estudiantes.
 *
 * Las funciones del motor devuelven `usuario_id` y `curso_id`, pero no
 * conocen programa ni grupo. En vez de tocar el SQL --y arriesgar los
 * valores de referencia-- se resuelve aquí qué estudiantes caen dentro del
 * programa o el grupo pedidos, y se intersecta con `usuarioIds`.
 *
 * Devuelve el mismo alcance cuando no hay nada que resolver, para no
 * consultar la base sin necesidad.
 */
export async function resolverJerarquia(alcance: Alcance): Promise<Alcance> {
  if (alcance.programaIds === null && alcance.grupoIds === null) return alcance
  if (alcanceVacio(alcance)) return alcance

  const db = clienteServidor()
  let q = db.from('usuarios').select('id').eq('rol', 'Estudiante')

  if (alcance.grupoIds !== null) {
    q = q.in('grupo_id', alcance.grupoIds)
  } else if (alcance.programaIds !== null) {
    // Sin grupo, el programa se resuelve por sus cursos.
    const { data: cursosProg, error: eCursos } = await db
      .from('cursos').select('id').in('programa_id', alcance.programaIds)

    // Columna aún sin migrar: la jerarquía es aditiva, así que se sigue
    // con el alcance de siempre en vez de devolver cero filas.
    if (eCursos) {
      if (eCursos.code === 'PGRST205' || eCursos.code === '42703') return alcance
      throw new Error(`cursos del programa: ${eCursos.message}`)
    }
    q = q.in('curso_id', (cursosProg ?? []).map((c) => Number(c.id)))
  }

  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)
  if (alcance.usuarioIds !== null) q = q.in('id', alcance.usuarioIds)

  const { data, error } = await q
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42703') return alcance
    throw new Error(`resolver jerarquia: ${error.message}`)
  }

  return { ...alcance, usuarioIds: (data ?? []).map((u) => Number(u.id)) }
}

/** Índices por estudiante, ya ceñidos al alcance. */
export async function indicesPorEstudiante(
  alcance: Alcance,
  filtros: Filtros = {}
): Promise<IndicesEstudiante[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const { data, error } = await db.rpc('kpi_indice', {
    p_semanas: filtros.semanas ?? null,
  })
  if (error) throw new Error(`kpi_indice: ${error.message}`)

  return (data ?? [])
    .map((f: Record<string, unknown>) => ({
      usuarioId: num(f.usuario_id),
      cursoId: num(f.curso_id),
      universidadId: num(f.universidad_id),
      ite: num(f.ite), iau: num(f.iau), icom: num(f.icom),
      ipc: num(f.ipc), irp: num(f.irp), ctg: num(f.ctg),
    }))
    .filter((f: IndicesEstudiante) =>
      (alcance.universidadIds === null || alcance.universidadIds.includes(f.universidadId)) &&
      (alcance.cursoIds === null || alcance.cursoIds.includes(f.cursoId)) &&
      (alcance.usuarioIds === null || alcance.usuarioIds.includes(f.usuarioId))
    )
}

export interface Indices {
  ite: number | null; iau: number | null; icom: number | null
  ipc: number | null; irp: number | null; ctg: number | null
}

/**
 * Índices agregados del ámbito: promedio de los valores por estudiante.
 * Devuelve null cuando no hay estudiantes, para que la interfaz muestre
 * guion largo y "sin resultados aún" en vez de 0 %.
 */
export async function indices(
  alcance: Alcance,
  filtros: Filtros = {}
): Promise<Indices> {
  const filas = await indicesPorEstudiante(alcance, filtros)
  return {
    ite: media(filas.map((f) => f.ite)),
    iau: media(filas.map((f) => f.iau)),
    icom: media(filas.map((f) => f.icom)),
    ipc: media(filas.map((f) => f.ipc)),
    irp: media(filas.map((f) => f.irp)),
    ctg: media(filas.map((f) => f.ctg)),
  }
}

/** Índice global por curso, para el gráfico de barras. */
export async function indiceGlobalPorCurso(
  alcance: Alcance,
  filtros: Filtros = {}
): Promise<{ cursoId: number; ctg: number }[]> {
  const filas = await indicesPorEstudiante(alcance, filtros)
  const porCurso = new Map<number, number[]>()
  for (const f of filas) {
    porCurso.set(f.cursoId, [...(porCurso.get(f.cursoId) ?? []), f.ctg])
  }
  return [...porCurso.entries()]
    .map(([cursoId, v]) => ({ cursoId, ctg: media(v) ?? 0 }))
    .sort((a, b) => b.ctg - a.ctg)
}

/** Evolución semana a semana de los índices que admiten seguimiento. */
export async function evolucionSemanal(
  alcance: Alcance,
  semanas: number[] = [1, 2, 3, 4, 5, 6]
): Promise<{ semana: number; ite: number | null; iau: number | null
             icom: number | null; ipc: number | null; irp: number | null
             ctg: number | null }[]> {
  const out = []
  for (const s of semanas) {
    const i = await indices(alcance, { semanas: [s] })
    out.push({ semana: s, ...i })
  }
  return out
}

export interface EtapaEmbudo {
  etapa: number
  nombre: string
  criterio: string
  conteo: number
  conversion: number | null
}

/** Embudo de progresión, con la conversión entre etapas. */
export async function embudo(alcance: Alcance): Promise<EtapaEmbudo[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const { data, error } = await db.rpc('kpi_embudo', {
    p_universidades: alcance.universidadIds,
    p_cursos: alcance.cursoIds,
    p_usuarios: alcance.usuarioIds,
  })
  if (error) throw new Error(`kpi_embudo: ${error.message}`)

  const etapas = (data ?? []).map((f: Record<string, unknown>) => ({
    etapa: num(f.etapa),
    nombre: String(f.nombre),
    criterio: String(f.criterio),
    conteo: num(f.conteo),
  }))

  return etapas.map((e: Omit<EtapaEmbudo, "conversion">, i: number) => ({
    ...e,
    conversion: i === 0 || etapas[i - 1].conteo === 0
      ? null
      : (100 * e.conteo) / etapas[i - 1].conteo,
  }))
}

/** Índice de la mayor caída del embudo, para resaltarla en rojo. */
export function mayorCaida(etapas: EtapaEmbudo[]): number {
  let peor = -1
  let caida = 0
  for (let i = 1; i < etapas.length; i++) {
    const d = etapas[i - 1].conteo - etapas[i].conteo
    if (d > caida) { caida = d; peor = i }
  }
  return peor
}

/**
 * Indicadores del agente. Devuelven null mientras no haya datos de
 * seguimiento: la interfaz muestra guion largo, nunca 0 %.
 */
export interface IndicadoresAgente {
  tar: number | null   // Tasa de Aceptación de Recomendaciones
  nra: number | null   // Nivel de Recomendaciones Aplicadas
  trr: number | null   // Tasa de Respuesta a Recomendaciones
  eia: number | null   // Efectividad de la Intervención Adaptativa, en puntos
}

export async function indicadoresAgente(
  alcance: Alcance
): Promise<IndicadoresAgente> {
  const vacio = { tar: null, nra: null, trr: null, eia: null }
  if (alcanceVacio(alcance)) return vacio

  const db = clienteServidor()
  let q = db.from('recomendaciones_ia')
    .select('estado, aplicada, fecha_respuesta, valor_antes, valor_despues, curso_id, usuario_id')
  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)

  const { data, error } = await q
  if (error) throw new Error(`recomendaciones_ia: ${error.message}`)

  const filas = (data ?? []).filter((r) =>
    alcance.usuarioIds === null ||
    r.usuario_id === null ||                              // las grupales siempre entran
    alcance.usuarioIds.includes(Number(r.usuario_id))
  )
  if (filas.length === 0) return vacio

  const aprobadas = filas.filter((r) => r.estado === 'Aprobada')
  const conMedicion = filas.filter(
    (r) => r.valor_antes !== null && r.valor_despues !== null
  )
  const conRespuesta = filas.filter((r) => r.fecha_respuesta !== null)
  const aceptadas = filas.filter(
    (r) => r.estado === 'Aprobada' || r.estado === 'Implementada'
  )

  // Mientras el ciclo de revisión no haya empezado, estos indicadores no
  // valen 0 %: es que todavía no hay resultados. La interfaz muestra guion
  // largo y "sin resultados aún". Un 0 % afirmaría que se rechazó todo.
  const huboRevision = filas.some(
    (r) => r.estado !== 'Pendiente de revisión docente' || r.fecha_respuesta !== null
  )

  return {
    tar: huboRevision ? (100 * aceptadas.length) / filas.length : null,
    // Sin ninguna aprobada no hay denominador.
    nra: aprobadas.length === 0
      ? null
      : (100 * filas.filter((r) => r.aplicada).length) / aprobadas.length,
    trr: conRespuesta.length === 0
      ? null
      : (100 * conRespuesta.length) / filas.length,
    eia: conMedicion.length === 0
      ? null
      : media(conMedicion.map((r) => num(r.valor_despues) - num(r.valor_antes))),
  }
}

/** Indicadores de resultados de aprendizaje, agregados del ámbito. */
export interface IndicadoresIlo {
  ilra: number | null
  tlc: number | null
  iba: number | null   // en puntos, puede ser negativo
  nla: number | null
}

export async function indicadoresIlo(
  alcance: Alcance
): Promise<IndicadoresIlo> {
  const vacio = { ilra: null, tlc: null, iba: null, nla: null }
  if (alcanceVacio(alcance)) return vacio

  const db = clienteServidor()
  const { data, error } = await db.rpc('kpi_ilo')
  if (error) throw new Error(`kpi_ilo: ${error.message}`)

  const filas = (data ?? []).filter((f: Record<string, unknown>) =>
    (alcance.cursoIds === null || alcance.cursoIds.includes(num(f.curso_id))) &&
    (alcance.usuarioIds === null || alcance.usuarioIds.includes(num(f.usuario_id)))
  )
  if (filas.length === 0) return vacio

  return {
    ilra: media(filas.map((f: Record<string, unknown>) => num(f.ilra))),
    tlc: media(filas.map((f: Record<string, unknown>) => num(f.tlc))),
    iba: media(filas.map((f: Record<string, unknown>) => num(f.iba))),
    nla: media(filas.map((f: Record<string, unknown>) => num(f.nla))),
  }
}

/** ILRA individual por estudiante, para el detalle del estudiante. */
export async function iloPorEstudiante(
  alcance: Alcance
): Promise<{ usuarioId: number; ilra: number; tlc: number; iba: number; nla: number }[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()
  const { data, error } = await db.rpc('kpi_ilo')
  if (error) throw new Error(`kpi_ilo: ${error.message}`)
  return (data ?? [])
    .map((f: Record<string, unknown>) => ({
      usuarioId: num(f.usuario_id), cursoId: num(f.curso_id),
      ilra: num(f.ilra), tlc: num(f.tlc), iba: num(f.iba), nla: num(f.nla),
    }))
    .filter((f: { usuarioId: number; cursoId: number }) =>
      (alcance.cursoIds === null || alcance.cursoIds.includes(f.cursoId)) &&
      (alcance.usuarioIds === null || alcance.usuarioIds.includes(f.usuarioId))
    )
}

/** Tasa de logro por competencia (TLC), agrupada por ILO. */
export async function tlcPorIlo(
  alcance: Alcance,
  filtros: { ilo?: string | null; competencia?: string | null } = {}
): Promise<{ ilo: string; competencia: string; tlc: number }[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()

  let q = db.from('resultados_aprendizaje')
    .select('ilo, competencia, logro_porcentaje, curso_id, usuario_id')
  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)
  if (alcance.usuarioIds !== null) q = q.in('usuario_id', alcance.usuarioIds)
  if (filtros.ilo) q = q.eq('ilo', filtros.ilo)
  if (filtros.competencia) q = q.eq('competencia', filtros.competencia)

  const { data, error } = await q
  if (error) throw new Error(`resultados_aprendizaje: ${error.message}`)

  const grupos = new Map<string, { competencia: string; valores: number[] }>()
  for (const r of data ?? []) {
    const k = String(r.ilo)
    const g = grupos.get(k) ?? { competencia: String(r.competencia), valores: [] }
    g.valores.push(num(r.logro_porcentaje))
    grupos.set(k, g)
  }
  return [...grupos.entries()]
    .map(([ilo, g]) => ({ ilo, competencia: g.competencia, tlc: media(g.valores) ?? 0 }))
    .sort((a, b) => a.ilo.localeCompare(b.ilo))
}

/** TLC por ILO y curso, para la matriz del Asesor. */
export async function tlcPorIloYCurso(
  alcance: Alcance
): Promise<Map<string, Map<number, number>>> {
  const salida = new Map<string, Map<number, number>>()
  if (alcanceVacio(alcance)) return salida

  const db = clienteServidor()
  let q = db.from('resultados_aprendizaje').select('ilo, logro_porcentaje, curso_id, usuario_id')
  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)
  if (alcance.usuarioIds !== null) q = q.in('usuario_id', alcance.usuarioIds)
  const { data, error } = await q
  if (error) throw new Error(`resultados_aprendizaje: ${error.message}`)

  const acum = new Map<string, Map<number, number[]>>()
  for (const r of data ?? []) {
    const ilo = String(r.ilo)
    const curso = num(r.curso_id)
    if (!acum.has(ilo)) acum.set(ilo, new Map())
    const porCurso = acum.get(ilo)!
    porCurso.set(curso, [...(porCurso.get(curso) ?? []), num(r.logro_porcentaje)])
  }
  for (const [ilo, porCurso] of acum) {
    const m = new Map<number, number>()
    for (const [curso, vals] of porCurso) m.set(curso, media(vals) ?? 0)
    salida.set(ilo, m)
  }
  return salida
}

/** Recomendaciones del ámbito, para la tabla y el gráfico del Asesor. */
export interface Recomendacion {
  id: number
  codigo: string
  cursoId: number
  usuarioId: number | null
  tipo: string
  competencia: string
  nivelActual: string
  nivelMeta: string
  brecha: number
  recomendacion: string
  estado: string
}

export async function recomendaciones(
  alcance: Alcance,
  filtros: { competencia?: string | null } = {}
): Promise<Recomendacion[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()

  let q = db.from('recomendaciones_ia')
    .select('id, codigo, curso_id, usuario_id, tipo, competencia, nivel_actual, nivel_meta, brecha, recomendacion, estado')
    .order('codigo')
  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)
  if (filtros.competencia) q = q.eq('competencia', filtros.competencia)

  const { data, error } = await q
  if (error) throw new Error(`recomendaciones_ia: ${error.message}`)

  return (data ?? [])
    .filter((r) =>
      alcance.usuarioIds === null ||
      r.usuario_id === null ||
      alcance.usuarioIds.includes(num(r.usuario_id))
    )
    .map((r) => ({
      id: num(r.id), codigo: String(r.codigo), cursoId: num(r.curso_id),
      usuarioId: r.usuario_id === null ? null : num(r.usuario_id),
      tipo: String(r.tipo), competencia: String(r.competencia),
      nivelActual: String(r.nivel_actual), nivelMeta: String(r.nivel_meta),
      brecha: num(r.brecha), recomendacion: String(r.recomendacion),
      estado: String(r.estado),
    }))
}
