import { z } from 'zod'

/**
 * Contrato de la respuesta del agente.
 *
 * El modelo responde con salida estructurada (output_config.format), así que
 * el JSON ya viene validado contra el esquema por la API. Zod lo vuelve a
 * validar antes de insertar: la API garantiza la forma, no el contenido.
 */

export const COMPETENCIAS_VALIDAS = [
  'Trabajo en Equipo',
  'Aprendizaje Autónomo',
  'Comunicación Efectiva',
  'Pensamiento Crítico',
  'Resolución de Problemas',
] as const

export const NIVELES_VALIDOS = ['Básico', 'Satisfactorio', 'Alto', 'Excelente'] as const

export const RecomendacionIA = z.object({
  competencia: z.enum(COMPETENCIAS_VALIDAS),
  nivel_actual: z.enum(NIVELES_VALIDOS),
  nivel_meta: z.enum(NIVELES_VALIDOS),
  brecha: z.number().min(0).max(100),
  /** Acción pedagógica concreta, una o dos frases, en imperativo. */
  recomendacion: z.string().min(20).max(400),
  /** Qué dato del estudiante la motiva. */
  justificacion: z.string().min(20).max(400),
  /**
   * Código del sub-indicador peor evaluado dentro de la competencia.
   * Hay códigos de dos letras (NA, NS, EA, TD, TA, TE, FA), así que el
   * mínimo es 2; exigir más rechazaba respuestas correctas.
   */
  sub_indicador_critico: z.string().trim().min(1).max(40),
})

export const RespuestaAgente = z.object({
  recomendaciones: z.array(RecomendacionIA).min(1).max(2),
})

export type RecomendacionIA = z.infer<typeof RecomendacionIA>
export type RespuestaAgente = z.infer<typeof RespuestaAgente>

/**
 * Esquema JSON para output_config.format.
 * Debe ir en sincronía con el Zod de arriba.
 */
export const ESQUEMA_JSON = {
  type: 'object',
  properties: {
    // La API no admite minItems/maxItems en el esquema de salida
    // estructurada: la cantidad se pide en el prompt y la valida Zod.
    recomendaciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          competencia: { type: 'string', enum: [...COMPETENCIAS_VALIDAS] },
          nivel_actual: { type: 'string', enum: [...NIVELES_VALIDOS] },
          nivel_meta: { type: 'string', enum: [...NIVELES_VALIDOS] },
          brecha: { type: 'number' },
          recomendacion: {
            type: 'string',
            description:
              'Acción pedagógica específica y verificable, UNA O DOS FRASES como máximo, en imperativo, dirigida al docente. Máximo 300 caracteres.',
          },
          justificacion: {
            type: 'string',
            description:
              'Qué dato concreto del estudiante motiva la recomendación. Una o dos frases. Debe nombrar el sub-indicador con peor desempeño. Máximo 300 caracteres.',
          },
          sub_indicador_critico: {
            type: 'string',
            description:
              'Sólo el código del sub-indicador peor evaluado, por ejemplo NCG o CLT. Sin nombre ni cifras.',
          },
        },
        required: [
          'competencia', 'nivel_actual', 'nivel_meta', 'brecha',
          'recomendacion', 'justificacion', 'sub_indicador_critico',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['recomendaciones'],
  additionalProperties: false,
} as const
