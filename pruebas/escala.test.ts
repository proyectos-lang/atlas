import { describe, expect, it } from 'vitest'
import { NIVELES, colorDe, metaDe, nivelDe } from '@/lib/kpi/escala'

/** Contraste WCAG entre dos colores hex. */
function contraste(a: string, b: string): number {
  const canal = (h: string) => {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
  }
  const lum = (h: string) => {
    const [r, g, bl] = canal(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('escala de niveles de dominio', () => {
  it.each([
    [0, 'Básico'], [45, 'Básico'], [59.9, 'Básico'],
    [60, 'Satisfactorio'], [70, 'Satisfactorio'], [74.9, 'Satisfactorio'],
    [75, 'Alto'], [82, 'Alto'], [89.9, 'Alto'],
    [90, 'Excelente'], [100, 'Excelente'],
  ] as const)('%s %% es nivel %s', (valor, esperado) => {
    expect(nivelDe(valor).nivel).toBe(esperado)
  })

  it('acota los valores fuera de rango en vez de fallar', () => {
    expect(nivelDe(-10).nivel).toBe('Básico')
    expect(nivelDe(150).nivel).toBe('Excelente')
    expect(nivelDe(NaN).nivel).toBe('Básico')
  })

  it('usa los colores que definió el usuario final', () => {
    expect(colorDe(30)).toBe('#C0392B')
    expect(colorDe(65)).toBe('#F2C14E')
    expect(colorDe(80)).toBe('#57A773')
    expect(colorDe(95)).toBe('#1B7F4B')
  })
})

describe('contraste del texto sobre cada nivel', () => {
  // El usuario fijó los colores de fondo; los de texto se eligen aquí.
  // Todos deben cumplir WCAG AA (4,5:1) para texto normal.
  it.each(NIVELES.map((n) => [n.nivel, n.color, n.colorTexto] as const))(
    '%s: %s con texto %s cumple AA',
    (_nivel, fondo, texto) => {
      expect(contraste(fondo, texto)).toBeGreaterThanOrEqual(4.5)
    }
  )

  it('el nivel Alto no usa texto blanco: daría 2,92:1', () => {
    const alto = NIVELES.find((n) => n.nivel === 'Alto')!
    expect(contraste(alto.color, '#FFFFFF')).toBeLessThan(4.5)
    expect(alto.colorTexto).not.toBe('#FFFFFF')
  })
})

describe('meta del siguiente nivel', () => {
  it.each([
    [45, 60], [65, 75], [82, 90],
  ] as const)('desde %s la meta es %s', (valor, meta) => {
    expect(metaDe(valor).meta).toBe(meta)
  })

  it('en Excelente no hay meta: se mantiene el nivel', () => {
    const m = metaDe(95)
    expect(m.meta).toBeNull()
    expect(m.faltan).toBeNull()
    expect(m.texto).toBe('Mantener el nivel de dominio')
  })

  it('el texto dice cuántos puntos faltan, con coma decimal', () => {
    expect(metaDe(68.6).texto).toBe('Faltan 6,4 puntos para llegar a 75')
  })

  it('nunca propone una distancia negativa', () => {
    for (let v = 0; v <= 100; v += 0.5) {
      const f = metaDe(v).faltan
      if (f !== null) expect(f).toBeGreaterThanOrEqual(0)
    }
  })
})
