/**
 * Catálogo de los 36 indicadores.
 *
 * Fuente: tabla maestra de ATLAS_indicadores_fuentes_dax.docx, más los
 * campos de seguimiento semanal y estado del dato definidos para este
 * sistema.
 *
 * REGLA DE INTERFAZ: nunca se muestra el código (ICOL, CTG) al usuario
 * final, siempre el nombre completo. Los códigos son llave interna.
 */

export type NivelKpi = 'Índice' | 'Sub-KPI' | 'Índice Global' | 'ILO' | 'Global'
export type EstadoDato = 'Directo' | 'Parámetro' | 'Semilla' | 'Derivado' | 'Sin fuente'
export type Seguimiento = 'Sí' | 'Parcial' | 'No'
export type Escala = 'Porcentaje' | 'Puntos'

export interface Indicador {
  orden: number
  codigo: string
  nombre: string
  competencia: string
  nivel: NivelKpi
  fuente: string
  formulaCorta: string
  escala: Escala
  truncar100: boolean
  estadoDato: EstadoDato
  seguimientoSemanal: Seguimiento
}

const TE = 'Trabajo en Equipo'
const AA = 'Aprendizaje Autónomo'
const CE = 'Comunicación Efectiva'
const PC = 'Pensamiento Crítico'
const RP = 'Resolución de Problemas'
const TR = 'Transversal'

export const CATALOGO: readonly Indicador[] = [
  // ---------- Trabajo en Equipo ----------
  { orden: 1, codigo: 'ITE', nombre: 'Índice de Trabajo en Equipo', competencia: TE, nivel: 'Índice', fuente: 'Promedio de sus cinco sub-indicadores', formulaCorta: 'Promedio simple de ICOL, TPI, RIP, NCG y TA', escala: 'Porcentaje', truncar100: true, estadoDato: 'Derivado', seguimientoSemanal: 'Sí' },
  { orden: 2, codigo: 'ICOL', nombre: 'Índice de Colaboración', competencia: TE, nivel: 'Sub-KPI', fuente: 'Colaboración y foros', formulaCorta: 'Interacciones colaborativas sobre el total de interacciones', escala: 'Porcentaje', truncar100: false, estadoDato: 'Directo', seguimientoSemanal: 'Sí' },
  { orden: 3, codigo: 'TPI', nombre: 'Tasa de Participación en Interacciones', competencia: TE, nivel: 'Sub-KPI', fuente: 'Foros y parámetros', formulaCorta: 'Intervenciones sobre las esperadas en el curso', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },
  { orden: 4, codigo: 'RIP', nombre: 'Reciprocidad de Interacción entre Pares', competencia: TE, nivel: 'Sub-KPI', fuente: 'Foros y parámetros', formulaCorta: 'Respuestas emitidas y recibidas sobre las esperadas', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },
  { orden: 5, codigo: 'NCG', nombre: 'Nivel de Contribución Grupal', competencia: TE, nivel: 'Sub-KPI', fuente: 'Colaboración', formulaCorta: 'Aportes del estudiante sobre los aportes de su curso', escala: 'Porcentaje', truncar100: true, estadoDato: 'Directo', seguimientoSemanal: 'Sí' },
  { orden: 6, codigo: 'TA', nombre: 'Tasa de Aportes', competencia: TE, nivel: 'Sub-KPI', fuente: 'Colaboración y parámetros', formulaCorta: 'Aportes sobre los esperados en el curso', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },

  // ---------- Aprendizaje Autónomo ----------
  { orden: 7, codigo: 'IAU', nombre: 'Índice de Aprendizaje Autónomo', competencia: AA, nivel: 'Índice', fuente: 'Promedio de sus cinco sub-indicadores', formulaCorta: 'Promedio simple de FA, TE, UPR, CPP y TPS', escala: 'Porcentaje', truncar100: true, estadoDato: 'Derivado', seguimientoSemanal: 'Parcial' },
  { orden: 8, codigo: 'FA', nombre: 'Frecuencia de Acceso', competencia: AA, nivel: 'Sub-KPI', fuente: 'Registros de Moodle y parámetros', formulaCorta: 'Accesos sobre los esperados en el curso', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },
  { orden: 9, codigo: 'TE', nombre: 'Tiempo de Estudio', competencia: AA, nivel: 'Sub-KPI', fuente: 'Registros de Moodle y parámetros', formulaCorta: 'Minutos de estudio sobre los esperados', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },
  { orden: 10, codigo: 'UPR', nombre: 'Uso de Recursos de Aprendizaje', competencia: AA, nivel: 'Sub-KPI', fuente: 'Registros de Moodle y parámetros', formulaCorta: 'Recursos consultados sobre los esperados', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },
  { orden: 11, codigo: 'CPP', nombre: 'Cumplimiento de Plazos Programados', competencia: AA, nivel: 'Sub-KPI', fuente: 'Evaluaciones y parámetros', formulaCorta: 'Entregas puntuales sobre las actividades programadas', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'No' },
  { orden: 12, codigo: 'TPS', nombre: 'Tasa de Persistencia del Estudiante', competencia: AA, nivel: 'Sub-KPI', fuente: 'Registros de Moodle', formulaCorta: 'Semanas con actividad sobre las semanas del ámbito', escala: 'Porcentaje', truncar100: true, estadoDato: 'Directo', seguimientoSemanal: 'Sí' },

  // ---------- Comunicación Efectiva ----------
  { orden: 13, codigo: 'ICOM', nombre: 'Índice de Comunicación Efectiva', competencia: CE, nivel: 'Índice', fuente: 'Promedio de sus cuatro sub-indicadores', formulaCorta: 'Promedio simple de CLT, NPA, CID y CRF', escala: 'Porcentaje', truncar100: true, estadoDato: 'Derivado', seguimientoSemanal: 'Sí' },
  { orden: 14, codigo: 'CLT', nombre: 'Calidad Lingüística del Texto', competencia: CE, nivel: 'Sub-KPI', fuente: 'Foros', formulaCorta: 'Promedio de la calidad argumentativa registrada', escala: 'Porcentaje', truncar100: false, estadoDato: 'Directo', seguimientoSemanal: 'Sí' },
  { orden: 15, codigo: 'NPA', nombre: 'Participaciones Argumentativas', competencia: CE, nivel: 'Sub-KPI', fuente: 'Foros y parámetros', formulaCorta: 'Participaciones sobre el umbral de calidad, sobre el total', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },
  { orden: 16, codigo: 'CID', nombre: 'Capacidad de Interacción en Debates', competencia: CE, nivel: 'Sub-KPI', fuente: 'Foros y parámetros', formulaCorta: 'Respuestas emitidas sobre las esperadas en debates', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'Sí' },
  { orden: 17, codigo: 'CRF', nombre: 'Calidad de Retroalimentación Formativa', competencia: CE, nivel: 'Sub-KPI', fuente: 'Colaboración', formulaCorta: 'Promedio de la evaluación recibida de los pares', escala: 'Porcentaje', truncar100: false, estadoDato: 'Directo', seguimientoSemanal: 'Sí' },

  // ---------- Pensamiento Crítico (rúbrica: dato semilla) ----------
  { orden: 18, codigo: 'IPC', nombre: 'Índice de Pensamiento Crítico', competencia: PC, nivel: 'Índice', fuente: 'Promedio de sus cuatro sub-indicadores', formulaCorta: 'Promedio simple de NA, NS, EA y TD', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Sí' },
  { orden: 19, codigo: 'NA', nombre: 'Nivel de Argumentación', competencia: PC, nivel: 'Sub-KPI', fuente: 'Rúbrica del docente', formulaCorta: 'Puntaje obtenido sobre el puntaje máximo del criterio', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Sí' },
  { orden: 20, codigo: 'NS', nombre: 'Nivel de Síntesis', competencia: PC, nivel: 'Sub-KPI', fuente: 'Rúbrica del docente', formulaCorta: 'Puntaje obtenido sobre el puntaje máximo del criterio', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Sí' },
  { orden: 21, codigo: 'EA', nombre: 'Evaluación de Alternativas', competencia: PC, nivel: 'Sub-KPI', fuente: 'Rúbrica del docente', formulaCorta: 'Puntaje obtenido sobre el puntaje máximo del criterio', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Sí' },
  { orden: 22, codigo: 'TD', nombre: 'Toma de Decisiones Fundamentadas', competencia: PC, nivel: 'Sub-KPI', fuente: 'Rúbrica del docente', formulaCorta: 'Puntaje obtenido sobre el puntaje máximo del criterio', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Sí' },

  // ---------- Resolución de Problemas ----------
  { orden: 23, codigo: 'IRP', nombre: 'Índice de Resolución de Problemas', competencia: RP, nivel: 'Índice', fuente: 'Promedio de sus cuatro sub-indicadores', formulaCorta: 'Promedio simple de NIA, TRA, UEA y DPA', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Parcial' },
  { orden: 24, codigo: 'NIA', nombre: 'Nivel de Identificación de Problemas', competencia: RP, nivel: 'Sub-KPI', fuente: 'Rúbrica del docente', formulaCorta: 'Puntaje obtenido sobre el puntaje máximo del criterio', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Sí' },
  { orden: 25, codigo: 'TRA', nombre: 'Tasa de Resolución de Actividades', competencia: RP, nivel: 'Sub-KPI', fuente: 'Evaluaciones y parámetros', formulaCorta: 'Actividades sobre el umbral de resolución, sobre el total', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'No' },
  { orden: 26, codigo: 'UEA', nombre: 'Uso de Estrategias de Análisis', competencia: RP, nivel: 'Sub-KPI', fuente: 'Rúbrica del docente', formulaCorta: 'Puntaje obtenido sobre el puntaje máximo del criterio', escala: 'Porcentaje', truncar100: true, estadoDato: 'Semilla', seguimientoSemanal: 'Sí' },
  { orden: 27, codigo: 'DPA', nombre: 'Desempeño en Problemas Aplicados', competencia: RP, nivel: 'Sub-KPI', fuente: 'Evaluaciones', formulaCorta: 'Calificación obtenida sobre el puntaje máximo', escala: 'Porcentaje', truncar100: true, estadoDato: 'Directo', seguimientoSemanal: 'No' },

  // ---------- Global e ILOs ----------
  { orden: 28, codigo: 'CTG', nombre: 'Competencia Transversal Global', competencia: TR, nivel: 'Índice Global', fuente: 'Los cinco índices y sus pesos', formulaCorta: 'Suma de índice por peso, dividida entre la suma de pesos', escala: 'Porcentaje', truncar100: true, estadoDato: 'Derivado', seguimientoSemanal: 'Parcial' },
  { orden: 29, codigo: 'ILRA', nombre: 'Índice de Logro de Resultados de Aprendizaje', competencia: TR, nivel: 'ILO', fuente: 'Resultados de aprendizaje y parámetros', formulaCorta: 'Resultados sobre el umbral de logro, sobre los evaluados', escala: 'Porcentaje', truncar100: true, estadoDato: 'Parámetro', seguimientoSemanal: 'No' },
  { orden: 30, codigo: 'TLC', nombre: 'Tasa de Logro por Competencia', competencia: TR, nivel: 'ILO', fuente: 'Resultados de aprendizaje', formulaCorta: 'Promedio del logro de los resultados asociados', escala: 'Porcentaje', truncar100: false, estadoDato: 'Directo', seguimientoSemanal: 'No' },
  { orden: 31, codigo: 'IBA', nombre: 'Índice de Brecha de Aprendizaje', competencia: TR, nivel: 'ILO', fuente: 'Resultados de aprendizaje y parámetros', formulaCorta: 'Logro esperado menos logro alcanzado, en puntos', escala: 'Puntos', truncar100: false, estadoDato: 'Parámetro', seguimientoSemanal: 'No' },
  { orden: 32, codigo: 'NLA', nombre: 'Nivel de Logro del Aprendizaje', competencia: TR, nivel: 'ILO', fuente: 'Evaluaciones', formulaCorta: 'Calificación obtenida sobre el puntaje máximo', escala: 'Porcentaje', truncar100: true, estadoDato: 'Directo', seguimientoSemanal: 'No' },

  // ---------- Del agente: sin datos hasta que haya seguimiento ----------
  { orden: 33, codigo: 'TAR', nombre: 'Tasa de Aceptación de Recomendaciones', competencia: TR, nivel: 'Global', fuente: 'Recomendaciones del asistente', formulaCorta: 'Aprobadas e implementadas sobre el total emitido', escala: 'Porcentaje', truncar100: true, estadoDato: 'Sin fuente', seguimientoSemanal: 'No' },
  { orden: 34, codigo: 'NRA', nombre: 'Nivel de Recomendaciones Aplicadas', competencia: TR, nivel: 'Global', fuente: 'Recomendaciones del asistente', formulaCorta: 'Aplicadas sobre las aprobadas', escala: 'Porcentaje', truncar100: true, estadoDato: 'Sin fuente', seguimientoSemanal: 'No' },
  { orden: 35, codigo: 'TRR', nombre: 'Tasa de Respuesta a Recomendaciones', competencia: TR, nivel: 'Global', fuente: 'Recomendaciones del asistente', formulaCorta: 'Con fecha de respuesta sobre el total emitido', escala: 'Porcentaje', truncar100: true, estadoDato: 'Sin fuente', seguimientoSemanal: 'No' },
  { orden: 36, codigo: 'EIA', nombre: 'Efectividad de la Intervención Adaptativa', competencia: TR, nivel: 'Global', fuente: 'Recomendaciones del asistente', formulaCorta: 'Promedio de la mejora entre el valor antes y después', escala: 'Puntos', truncar100: false, estadoDato: 'Sin fuente', seguimientoSemanal: 'No' },
] as const

const POR_CODIGO = new Map(CATALOGO.map((i) => [i.codigo, i]))

export function indicador(codigo: string): Indicador | undefined {
  return POR_CODIGO.get(codigo)
}

/** Nombre completo. Nunca mostrar el código al usuario final. */
export function nombreDe(codigo: string): string {
  return POR_CODIGO.get(codigo)?.nombre ?? codigo
}

/**
 * ¿Se calcula sobre datos de rúbrica que todavía son semilla?
 *
 * Es el hecho, y no depende de si la interfaz lo muestra: el agente de IA
 * lo consulta para no fundamentar recomendaciones en estos indicadores.
 * No usar para decidir qué pintar en pantalla — para eso está
 * `mostrarAvisoSemilla()`.
 */
export function esSemilla(codigo: string): boolean {
  return POR_CODIGO.get(codigo)?.estadoDato === 'Semilla'
}

/**
 * ¿La interfaz debe advertir de que el dato es semilla?
 *
 * Decisión de producto, separada del hecho: los avisos se retiraron de la
 * interfaz por petición expresa, pero los datos de rúbrica SIGUEN siendo
 * semilla generada por fórmula, no evaluación real del docente.
 *
 * Poner esto en `true` devuelve todos los avisos a la interfaz de una vez.
 * Lo que nunca debe hacerse es tocar `esSemilla()` para apagarlos: eso
 * desarmaría la restricción del agente, que sí depende del hecho.
 */
export const MOSTRAR_AVISOS_SEMILLA = false

export function mostrarAvisoSemilla(codigo: string): boolean {
  return MOSTRAR_AVISOS_SEMILLA && esSemilla(codigo)
}

export const AVISO_SEMILLA =
  'Calculado sobre datos de rúbrica simulados. Reemplazar por evaluación real del docente.'

/** Indicadores que admiten gráfico de evolución temporal. */
export function conSeguimientoSemanal(): Indicador[] {
  return CATALOGO.filter((i) => i.seguimientoSemanal !== 'No')
}

/** Van al panel "Valores del período — sin seguimiento semanal". */
export function sinSeguimientoSemanal(): Indicador[] {
  return CATALOGO.filter((i) => i.seguimientoSemanal === 'No')
}

export const COMPETENCIAS = [TE, AA, CE, PC, RP] as const

/** Código del índice de cada competencia. */
export const INDICE_DE_COMPETENCIA: Record<string, string> = {
  [TE]: 'ITE', [AA]: 'IAU', [CE]: 'ICOM', [PC]: 'IPC', [RP]: 'IRP',
}
