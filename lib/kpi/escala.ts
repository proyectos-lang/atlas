/**
 * Escala de niveles de dominio.
 * Definida por el usuario final; es transversal a toda la aplicación.
 * Se implementa UNA sola vez aquí y se usa en todos lados.
 */

export type Nivel = 'Básico' | 'Satisfactorio' | 'Alto' | 'Excelente'

export interface DefinicionNivel {
  nivel: Nivel
  minimo: number
  maximo: number
  color: string
  colorTexto: string
  /** Umbral superior del nivel: la meta del siguiente. null en Excelente. */
  metaSiguiente: number | null
}

/**
 * Los colores de fondo son los que definió el usuario final y no se tocan.
 * Los colores de TEXTO sí se eligen aquí, por contraste medido (WCAG AA):
 *   Básico        #C0392B + blanco    5,44:1
 *   Satisfactorio #F2C14E + #3D2F00   7,80:1
 *   Alto          #57A773 + #0B2E1A   5,06:1   (con blanco daba 2,92:1, insuficiente)
 *   Excelente     #1B7F4B + blanco    5,02:1
 */
export const NIVELES: readonly DefinicionNivel[] = [
  { nivel: 'Básico',        minimo: 0,  maximo: 59.999999, color: '#C0392B', colorTexto: '#FFFFFF', metaSiguiente: 60 },
  { nivel: 'Satisfactorio', minimo: 60, maximo: 74.999999, color: '#F2C14E', colorTexto: '#3D2F00', metaSiguiente: 75 },
  { nivel: 'Alto',          minimo: 75, maximo: 89.999999, color: '#57A773', colorTexto: '#0B2E1A', metaSiguiente: 90 },
  { nivel: 'Excelente',     minimo: 90, maximo: 100,       color: '#1B7F4B', colorTexto: '#FFFFFF', metaSiguiente: null },
] as const

/** Nivel de dominio de un valor 0..100. */
export function nivelDe(valor: number): DefinicionNivel {
  if (!Number.isFinite(valor)) return NIVELES[0]
  const v = Math.min(Math.max(valor, 0), 100)
  return NIVELES.find((n) => v >= n.minimo && v <= n.maximo) ?? NIVELES[0]
}

export function colorDe(valor: number): string {
  return nivelDe(valor).color
}

/**
 * Meta del siguiente nivel y distancia hasta ella.
 * En Excelente no hay meta: el objetivo es mantener el nivel.
 */
export function metaDe(valor: number): {
  meta: number | null
  faltan: number | null
  texto: string
} {
  const def = nivelDe(valor)
  if (def.metaSiguiente === null) {
    return { meta: null, faltan: null, texto: 'Mantener el nivel de dominio' }
  }
  const faltan = Math.max(def.metaSiguiente - valor, 0)
  return {
    meta: def.metaSiguiente,
    faltan,
    texto: `Faltan ${faltan.toFixed(1).replace('.', ',')} puntos para llegar a ${def.metaSiguiente}`,
  }
}
