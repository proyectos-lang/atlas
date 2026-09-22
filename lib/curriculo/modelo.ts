import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

/**
 * Modelo curricular macro / meso / micro.
 *
 * Trazabilidad completa:
 *   Institución → Facultad → Programa            (macro)
 *     → Área → Línea → Semestre                   (meso)
 *       → Asignatura → Unidad → Actividad         (micro)
 *         → Resultado de aprendizaje → Competencia
 *           → Dimensión → Indicador
 *
 * Todas las lecturas toleran que la migración 09 no esté aplicada: si la
 * tabla no existe devuelven lista vacía en vez de romper la pantalla. El
 * modelo curricular es aditivo y nada de lo que ya funciona depende de él.
 */

/**
 * Fila cruda de una tabla del modelo curricular.
 *
 * El cliente de Supabase tipa sus respuestas desde el esquema que conoce,
 * y estas tablas pueden no existir todavía (migración 09 sin aplicar). Se
 * normaliza aquí, en el borde, y hacia dentro todo va tipado.
 */
type Fila = Record<string, unknown>

/** La tabla aún no existe: migración 09 o 10 sin aplicar. */
export type Ambito = 'Programa' | 'Area' | 'Curso'
export type Agregacion = 'Promedio' | 'Suma' | 'Proporcion' | 'Conteo' | 'Rubrica'
export type EscalaIndicador = 'Porcentaje' | 'Puntos'

export interface Competencia {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  transversal: boolean
  /** Student Outcome de ABET, si corresponde a uno. */
  studentOutcome: string | null
  programaId: number | null
  activo: boolean
  orden: number
}

export interface Dimension {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  competenciaId: number
  orden: number
  activo: boolean
}

export interface Indicador {
  id: number
  codigo: string
  nombre: string
  descripcion: string | null
  dimensionId: number
  agregacion: Agregacion
  valorEsperado: number | null
  umbral: number | null
  escala: EscalaIndicador
  truncar100: boolean
  prorratea: boolean
  cursoId: number | null
  activo: boolean
  orden: number
}

export interface Resultado {
  id: number
  codigo: string
  enunciado: string
  ambito: Ambito
  programaId: number | null
  areaId: number | null
  cursoId: number | null
  competenciaId: number | null
  activo: boolean
  orden: number
}

export interface Area {
  id: number
  codigo: string
  nombre: string
  tipo: string | null
  programaId: number
  descripcion: string | null
  activo: boolean
  orden: number
}

/**
 * Competencias visibles.
 *
 * Una competencia con `programa_id` nulo es global: la ven todos los
 * programas. Con programa asignado sólo la ve ese programa, y se filtra
 * por el alcance para que nadie vea las de un programa ajeno.
 */
export async function competencias(alcance: Alcance): Promise<Competencia[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const { data, error } = await db
    .from('competencias')
    .select('id, codigo, nombre, descripcion, transversal, student_outcome, programa_id, activo, orden')
    .order('orden')

  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`competencias: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((c) =>
      c.programa_id == null ||
      alcance.programaIds === null ||
      alcance.programaIds.includes(Number(c.programa_id))
    )
    .map((c) => ({
      id: Number(c.id),
      codigo: String(c.codigo),
      nombre: String(c.nombre),
      descripcion: c.descripcion == null ? null : String(c.descripcion),
      transversal: Boolean(c.transversal),
      studentOutcome: c.student_outcome == null ? null : String(c.student_outcome),
      programaId: c.programa_id == null ? null : Number(c.programa_id),
      activo: Boolean(c.activo),
      orden: Number(c.orden),
    }))
}

export async function dimensiones(competenciaIds?: number[]): Promise<Dimension[]> {
  const db = clienteServidor()
  let q = db
    .from('dimensiones')
    .select('id, codigo, nombre, descripcion, competencia_id, orden, activo')
    .order('orden')

  if (competenciaIds && competenciaIds.length > 0) {
    q = q.in('competencia_id', competenciaIds)
  }

  const { data, error } = await q
  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`dimensiones: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[]).map((d) => ({
    id: Number(d.id),
    codigo: String(d.codigo),
    nombre: String(d.nombre),
    descripcion: d.descripcion == null ? null : String(d.descripcion),
    competenciaId: Number(d.competencia_id),
    orden: Number(d.orden),
    activo: Boolean(d.activo),
  }))
}

export async function indicadores(dimensionIds?: number[]): Promise<Indicador[]> {
  const db = clienteServidor()
  let q = db
    .from('indicadores')
    .select(
      'id, codigo, nombre, descripcion, dimension_id, agregacion, valor_esperado, ' +
      'umbral, escala, trunca_100, prorratea, curso_id, activo, orden'
    )
    .order('orden')

  if (dimensionIds && dimensionIds.length > 0) {
    q = q.in('dimension_id', dimensionIds)
  }

  const { data, error } = await q
  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`indicadores: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[]).map((i) => ({
    id: Number(i.id),
    codigo: String(i.codigo),
    nombre: String(i.nombre),
    descripcion: i.descripcion == null ? null : String(i.descripcion),
    dimensionId: Number(i.dimension_id),
    agregacion: String(i.agregacion) as Agregacion,
    valorEsperado: i.valor_esperado == null ? null : Number(i.valor_esperado),
    umbral: i.umbral == null ? null : Number(i.umbral),
    escala: String(i.escala) as EscalaIndicador,
    truncar100: Boolean(i.trunca_100),
    prorratea: Boolean(i.prorratea),
    cursoId: i.curso_id == null ? null : Number(i.curso_id),
    activo: Boolean(i.activo),
    orden: Number(i.orden),
  }))
}

/**
 * Resultados de aprendizaje del alcance.
 *
 * El filtrado se hace en memoria y no con `.in()` por una razón: un
 * resultado de curso tiene `programa_id` nulo, así que filtrar por
 * programa en la consulta lo dejaría fuera. Hay que decidir por el
 * ámbito de cada fila cuál es su referencia.
 *
 * `alcance` es obligatorio. Sin él, un coordinador vería los resultados
 * de programas ajenos.
 */
export async function resultados(
  alcance: Alcance,
  cursoIds?: number[] | null
): Promise<Resultado[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const q = db
    .from('resultados')
    .select('id, codigo, enunciado, ambito, programa_id, area_id, curso_id, competencia_id, activo, orden')
    .order('orden')

  const { data, error } = await q
  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`resultados: ${error.message}`)
  }

  const cursosPermitidos = cursoIds ?? alcance.cursoIds

  return ((data ?? []) as unknown as Fila[])
    .filter((r) => {
      // Un resultado de programa se ciñe por programa; uno de curso, por
      // curso. Aplicar el filtro equivocado los haría desaparecer.
      if (r.ambito === 'Programa') {
        return (
          alcance.programaIds === null ||
          (r.programa_id != null && alcance.programaIds.includes(Number(r.programa_id)))
        )
      }
      if (r.ambito === 'Curso') {
        return (
          cursosPermitidos === null ||
          (r.curso_id != null && cursosPermitidos.includes(Number(r.curso_id)))
        )
      }
      // Los de área no tienen referencia directa al alcance: se muestran
      // cuando el alcance no restringe programas.
      return alcance.programaIds === null || alcance.programaIds.length > 0
    })
    .map((r) => ({
    id: Number(r.id),
    codigo: String(r.codigo),
    enunciado: String(r.enunciado),
    ambito: String(r.ambito) as Ambito,
    programaId: r.programa_id == null ? null : Number(r.programa_id),
    areaId: r.area_id == null ? null : Number(r.area_id),
    cursoId: r.curso_id == null ? null : Number(r.curso_id),
    competenciaId: r.competencia_id == null ? null : Number(r.competencia_id),
    activo: Boolean(r.activo),
    orden: Number(r.orden),
  }))
}

export async function areas(programaIds?: number[] | null): Promise<Area[]> {
  const db = clienteServidor()
  let q = db
    .from('areas')
    .select('id, codigo, nombre, tipo, programa_id, descripcion, activo, orden')
    .order('orden')

  if (programaIds) q = q.in('programa_id', programaIds)

  const { data, error } = await q
  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`areas: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[]).map((a) => ({
    id: Number(a.id),
    codigo: String(a.codigo),
    nombre: String(a.nombre),
    tipo: a.tipo == null ? null : String(a.tipo),
    programaId: Number(a.programa_id),
    descripcion: a.descripcion == null ? null : String(a.descripcion),
    activo: Boolean(a.activo),
    orden: Number(a.orden),
  }))
}

/** Competencia con sus dimensiones e indicadores ya anidados. */
export interface CompetenciaCompleta extends Competencia {
  dimensiones: (Dimension & { indicadores: Indicador[] })[]
}

/**
 * El árbol competencia → dimensión → indicador en una sola llamada.
 *
 * Es la estructura que piden las pantallas de configuración y la que
 * necesita el motor para saber qué medir.
 */
export async function arbolCompetencias(alcance: Alcance): Promise<CompetenciaCompleta[]> {
  const comps = await competencias(alcance)
  if (comps.length === 0) return []

  const dims = await dimensiones(comps.map((c) => c.id))
  const inds = dims.length > 0 ? await indicadores(dims.map((d) => d.id)) : []

  return comps.map((c) => ({
    ...c,
    dimensiones: dims
      .filter((d) => d.competenciaId === c.id)
      .map((d) => ({
        ...d,
        indicadores: inds.filter((i) => i.dimensionId === d.id),
      })),
  }))
}

/** ¿Está aplicado el modelo curricular? Para avisar en la interfaz. */
export async function modeloCurricularDisponible(): Promise<boolean> {
  const db = clienteServidor()
  const { error } = await db.from('competencias').select('id', { head: true, count: 'exact' })
  return !error
}
