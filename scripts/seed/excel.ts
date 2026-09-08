/**
 * Lectura del Excel de origen.
 *
 * Trampas confirmadas del archivo, manejadas aquí:
 *  1. Entrega_Puntual es 'Sí'/'No' con í = U+00ED, no booleano.
 *     Un fallo de encoding hace que CPP dé 0 y IAU caiga de 83,6 a 68,8:
 *     silencioso y verosímil. Por eso se compara por punto de código.
 *  2. Evaluaciones.Actividad trae el NOMBRE, no el código. La unión debe
 *     ser por (curso, nombre); sólo por nombre multiplicaría x3.
 *  3. Recomendaciones_IA trae 'TODOS' en ID_Estudiante para las grupales.
 */
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

export interface FilaUniversidad { ID_Universidad: string; Universidad: string; Programa: string; Modalidad: string }
export interface FilaCurso { ID_Curso: string; ID_Universidad: string; Curso: string; Semestre: number }
export interface FilaUsuario { ID_Estudiante: string; ID_Universidad: string; ID_Curso: string; Rol: string; Semestre: number }
export interface FilaActividad { ID_Actividad: string; ID_Curso: string; Actividad: string; Tipo: string; Competencia: string; ILO: string; Peso: number }
export interface FilaLog { ID_Estudiante: string; ID_Curso: string; Semana: number; Accesos: number; Minutos: number; Recursos_Consultados: number; Actividades_Visitadas: number }
export interface FilaForo { ID_Estudiante: string; ID_Curso: string; Semana: number; Intervenciones: number; Respuestas_Emitidas: number; Respuestas_Recibidas: number; Calidad_Argumentativa: number }
export interface FilaColaboracion { ID_Estudiante: string; ID_Curso: string; Semana: number; Aportes: number; Interacciones: number; Evaluacion_Pares: number; Rol_Grupo: string }
export interface FilaEvaluacion { ID_Estudiante: string; ID_Curso: string; Actividad: string; Calificacion: number; Puntaje_Maximo: number; Entrega_Puntual: string }
export interface FilaResultado { ID_Estudiante: string; ID_Curso: string; ILO: string; Competencia: string; Logro_Porcentaje: number; Nivel: string }
export interface FilaKpis { ID_Estudiante: string; ID_Curso: string; ITE: number; IAU: number; ICOM: number; IPC: number; IRP: number; CTG: number }
export interface FilaRecomendacion {
  ID_Recomendacion: string; ID_Curso: string; ID_Estudiante: string; Tipo: string
  Competencia: string; Nivel_Actual: string; Nivel_Meta: string; Brecha: number
  Recomendacion: string; Estado: string
}

export interface LibroAtlas {
  universidades: FilaUniversidad[]
  cursos: FilaCurso[]
  usuarios: FilaUsuario[]
  actividades: FilaActividad[]
  moodleLogs: FilaLog[]
  foros: FilaForo[]
  colaboracion: FilaColaboracion[]
  evaluaciones: FilaEvaluacion[]
  resultados: FilaResultado[]
  kpis: FilaKpis[]
  recomendaciones: FilaRecomendacion[]
}

function hoja<T>(libro: XLSX.WorkBook, nombre: string): T[] {
  const h = libro.Sheets[nombre]
  if (!h) throw new Error(`Falta la hoja "${nombre}" en el Excel`)
  // defval null mantiene las celdas vacías como null en vez de omitir la clave.
  return XLSX.utils.sheet_to_json<T>(h, { defval: null, raw: true })
}

export function leerLibro(ruta: string): LibroAtlas {
  // Leer como buffer y dejar que xlsx decodifique: preserva UTF-8 (í, ó, ñ).
  const libro = XLSX.read(readFileSync(ruta), { type: 'buffer', codepage: 65001 })
  return {
    universidades:   hoja<FilaUniversidad>(libro, 'Universidades'),
    cursos:          hoja<FilaCurso>(libro, 'Cursos'),
    usuarios:        hoja<FilaUsuario>(libro, 'Usuarios'),
    actividades:     hoja<FilaActividad>(libro, 'Actividades'),
    moodleLogs:      hoja<FilaLog>(libro, 'Moodle_Logs'),
    foros:           hoja<FilaForo>(libro, 'Foros'),
    colaboracion:    hoja<FilaColaboracion>(libro, 'Colaboracion'),
    evaluaciones:    hoja<FilaEvaluacion>(libro, 'Evaluaciones'),
    resultados:      hoja<FilaResultado>(libro, 'Resultados_Aprendizaje'),
    kpis:            hoja<FilaKpis>(libro, 'KPIs_Competencias'),
    recomendaciones: hoja<FilaRecomendacion>(libro, 'Recomendaciones_IA'),
  }
}

/**
 * TRAMPA 1. 'Sí' lleva í = U+00ED. Comparamos por punto de código y
 * normalizamos (NFC) para tolerar la forma descompuesta 'i' + acento.
 * Cualquier valor inesperado revienta: es preferible a un CPP silenciosamente 0.
 */
export function esPuntual(valor: unknown): boolean {
  if (typeof valor === 'boolean') return valor
  const t = String(valor ?? '').normalize('NFC').trim().toLowerCase()
  if (t === 'sí' || t === 'si' || t === 'true' || t === '1') return true
  if (t === 'no' || t === 'false' || t === '0') return false
  throw new Error(
    `Valor inesperado en Entrega_Puntual: ${JSON.stringify(valor)}. ` +
      `Revisar codificación del Excel (se espera 'Sí'/'No').`
  )
}

/** TRAMPA 3. Las grupales traen 'TODOS' en vez de un código de estudiante. */
export function esGrupal(idEstudiante: unknown): boolean {
  return String(idEstudiante ?? '').normalize('NFC').trim().toUpperCase() === 'TODOS'
}

export function aNumero(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) throw new Error(`No es número: ${JSON.stringify(v)}`)
  return n
}

export function aNumeroONulo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  return aNumero(v)
}

export function texto(v: unknown): string {
  return String(v ?? '').normalize('NFC').trim()
}
