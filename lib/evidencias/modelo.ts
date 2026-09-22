import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'

/**
 * Fuentes de datos, mapeos y evidencias.
 *
 * La cadena que sostiene este módulo:
 *
 *   Fuente → dato → evidencia → indicador → competencia → RA
 *
 * El LMS es una fuente más. Un curso presencial sin ninguna herramienta
 * digital registra evidencias por observación directa y produce los
 * mismos indicadores.
 */

type Fila = Record<string, unknown>

function faltaTabla(codigo?: string): boolean {
  return codigo === 'PGRST205' || codigo === '42P01' || codigo === '42703'
}

export type CategoriaFuente =
  | 'LMS' | 'Colaborativa' | 'Codigo' | 'Formulario'
  | 'Instrumento' | 'Observacion' | 'Archivo'

export type ModoIngreso = 'API' | 'Carga' | 'Manual'

export type Transformacion = 'Directo' | 'Escalar' | 'Normalizar' | 'Booleano'

export interface FuenteDatos {
  id: number
  codigo: string
  nombre: string
  categoria: CategoriaFuente
  modoIngreso: ModoIngreso
  descripcion: string | null
  activo: boolean
}

export interface Mapeo {
  id: number
  fuenteId: number
  indicadorId: number
  variable: string
  transformacion: Transformacion
  factor: number | null
  valorMaximo: number | null
  cursoId: number | null
  activo: boolean
}

export interface Evidencia {
  id: number
  usuarioId: number
  cursoId: number
  indicadorId: number
  fuenteId: number
  variable: string | null
  valor: number
  valorBruto: number | null
  valorMaximo: number | null
  semana: number | null
  fecha: string
  observaciones: string | null
}

/** Etiquetas legibles. Nunca se muestra el código al usuario final. */
export const NOMBRE_CATEGORIA: Record<CategoriaFuente, string> = {
  LMS: 'Plataforma LMS',
  Colaborativa: 'Herramienta colaborativa',
  Codigo: 'Repositorio o entorno de programación',
  Formulario: 'Formulario',
  Instrumento: 'Instrumento pedagógico',
  Observacion: 'Observación docente',
  Archivo: 'Archivo estructurado',
}

export const NOMBRE_MODO: Record<ModoIngreso, string> = {
  API: 'Integración automática',
  Carga: 'Carga de archivo',
  Manual: 'Registro manual',
}

export const NOMBRE_TRANSFORMACION: Record<Transformacion, string> = {
  Directo: 'El valor se usa tal cual',
  Escalar: 'Se multiplica por un factor',
  Normalizar: 'Se convierte a porcentaje sobre el máximo',
  Booleano: 'Sí vale 100, No vale 0',
}

export async function fuentes(soloActivas = false): Promise<FuenteDatos[]> {
  const db = clienteServidor()
  let q = db
    .from('fuentes_datos')
    .select('id, codigo, nombre, categoria, modo_ingreso, descripcion, activo')
    .order('categoria')
    .order('nombre')

  if (soloActivas) q = q.eq('activo', true)

  const { data, error } = await q
  if (error) {
    if (faltaTabla(error.code)) return []
    throw new Error(`fuentes: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: Number(f.id),
    codigo: String(f.codigo),
    nombre: String(f.nombre),
    categoria: String(f.categoria) as CategoriaFuente,
    modoIngreso: String(f.modo_ingreso) as ModoIngreso,
    descripcion: f.descripcion == null ? null : String(f.descripcion),
    activo: Boolean(f.activo),
  }))
}

export async function mapeos(cursoIds?: number[] | null): Promise<Mapeo[]> {
  const db = clienteServidor()
  const { data, error } = await db
    .from('mapeos')
    .select('id, fuente_id, indicador_id, variable, transformacion, factor, valor_maximo, curso_id, activo')
    .order('id')

  if (error) {
    if (faltaTabla(error.code)) return []
    throw new Error(`mapeos: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[])
    // Un mapeo sin curso aplica a todos; con curso, sólo a ese.
    .filter((m) =>
      m.curso_id == null ||
      !cursoIds ||
      cursoIds.includes(Number(m.curso_id))
    )
    .map((m) => ({
      id: Number(m.id),
      fuenteId: Number(m.fuente_id),
      indicadorId: Number(m.indicador_id),
      variable: String(m.variable),
      transformacion: String(m.transformacion) as Transformacion,
      factor: m.factor == null ? null : Number(m.factor),
      valorMaximo: m.valor_maximo == null ? null : Number(m.valor_maximo),
      cursoId: m.curso_id == null ? null : Number(m.curso_id),
      activo: Boolean(m.activo),
    }))
}

/**
 * Aplica la transformación de un mapeo a un valor bruto.
 *
 * Es la normalización del punto 5: da igual qué herramienta produjo el
 * dato, al indicador llega con la misma forma.
 */
export function normalizar(
  valorBruto: number,
  mapeo: Pick<Mapeo, 'transformacion' | 'factor' | 'valorMaximo'>
): number | null {
  switch (mapeo.transformacion) {
    case 'Directo':
      return valorBruto

    case 'Escalar':
      return mapeo.factor === null ? null : valorBruto * mapeo.factor

    case 'Normalizar':
      // Sin máximo no hay contra qué normalizar: devolver el bruto daría
      // un porcentaje falso.
      if (mapeo.valorMaximo === null || mapeo.valorMaximo === 0) return null
      return (100 * valorBruto) / mapeo.valorMaximo

    case 'Booleano':
      return valorBruto ? 100 : 0
  }
}

/** Evidencias de un ámbito, para auditar de dónde salió un indicador. */
export async function evidencias(
  alcance: Alcance,
  filtro: { indicadorId?: number; usuarioId?: number; limite?: number } = {}
): Promise<Evidencia[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  let q = db
    .from('evidencias')
    .select(
      'id, usuario_id, curso_id, indicador_id, fuente_id, variable, ' +
      'valor, valor_bruto, valor_maximo, semana, fecha, observaciones'
    )
    .order('fecha', { ascending: false })
    .limit(filtro.limite ?? 200)

  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)
  if (alcance.usuarioIds !== null) q = q.in('usuario_id', alcance.usuarioIds)
  if (filtro.indicadorId) q = q.eq('indicador_id', filtro.indicadorId)
  if (filtro.usuarioId) q = q.eq('usuario_id', filtro.usuarioId)

  const { data, error } = await q
  if (error) {
    if (faltaTabla(error.code)) return []
    throw new Error(`evidencias: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[]).map((e) => ({
    id: Number(e.id),
    usuarioId: Number(e.usuario_id),
    cursoId: Number(e.curso_id),
    indicadorId: Number(e.indicador_id),
    fuenteId: Number(e.fuente_id),
    variable: e.variable == null ? null : String(e.variable),
    valor: Number(e.valor),
    valorBruto: e.valor_bruto == null ? null : Number(e.valor_bruto),
    valorMaximo: e.valor_maximo == null ? null : Number(e.valor_maximo),
    semana: e.semana == null ? null : Number(e.semana),
    fecha: String(e.fecha),
    observaciones: e.observaciones == null ? null : String(e.observaciones),
  }))
}

export interface IndicadorCalculado {
  usuarioId: number
  cursoId: number
  indicadorId: number
  codigo: string
  dimensionId: number
  competenciaId: number
  valor: number | null
  evidencias: number
}

/**
 * Indicadores calculados desde evidencias, por estudiante.
 *
 * Es el motor nuevo. Devuelve una fila por estudiante e indicador, sin
 * agregar: quien consuma esto promedia después. Un indicador sin
 * evidencias no aparece, en vez de aparecer con 0 --que afirmaría que el
 * estudiante fue medido y obtuvo cero--.
 */
export async function indicadoresCalculados(
  alcance: Alcance,
  semanas: number[] | null = null
): Promise<IndicadorCalculado[]> {
  if (alcanceVacio(alcance)) return []

  const db = clienteServidor()
  const { data, error } = await db.rpc('kpi_evidencias', { p_semanas: semanas })

  if (error) {
    if (faltaTabla(error.code)) return []
    throw new Error(`kpi_evidencias: ${error.message}`)
  }

  return ((data ?? []) as unknown as Fila[])
    .filter((f) =>
      (alcance.cursoIds === null || alcance.cursoIds.includes(Number(f.curso_id))) &&
      (alcance.usuarioIds === null || alcance.usuarioIds.includes(Number(f.usuario_id)))
    )
    .map((f) => ({
      usuarioId: Number(f.usuario_id),
      cursoId: Number(f.curso_id),
      indicadorId: Number(f.indicador_id),
      codigo: String(f.codigo),
      dimensionId: Number(f.dimension_id),
      competenciaId: Number(f.competencia_id),
      valor: f.valor == null ? null : Number(f.valor),
      evidencias: Number(f.evidencias),
    }))
}

/** ¿Hay evidencias registradas? Para saber si el motor nuevo tiene con qué. */
export async function hayEvidencias(): Promise<boolean> {
  const db = clienteServidor()
  const { count, error } = await db
    .from('evidencias')
    .select('id', { count: 'exact', head: true })
  return !error && (count ?? 0) > 0
}
