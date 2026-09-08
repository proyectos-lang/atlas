import { metaDe, nivelDe } from '@/lib/kpi/escala'
import { BadgeNivel } from './base'

/**
 * Medidor semicircular (§8.6).
 * Arco de 0 a 100, relleno coloreado por nivel de dominio, marca gris sobre
 * el arco en la meta del siguiente nivel, valor grande al centro, y debajo
 * el nombre de la competencia con su badge.
 *
 * En el informe original esto lo dibujaba una medida DAX que devolvía HTML;
 * aquí se reconstruye en SVG.
 */

const R = 70          // radio del arco
const GROSOR = 14
const ANCHO = 180
const ALTO = 110
const CX = ANCHO / 2
const CY = 92

/** Punto del arco para un valor 0..100 (semicírculo de 180° a 0°). */
function punto(valor: number, radio: number) {
  const angulo = Math.PI * (1 - Math.min(Math.max(valor, 0), 100) / 100)
  return { x: CX + radio * Math.cos(angulo), y: CY - radio * Math.sin(angulo) }
}

/**
 * Arco de `desde` a `hasta` en la escala 0..100.
 *
 * El semicírculo completo abarca 180°, así que el barrido nunca supera media
 * vuelta: large-arc-flag es siempre 0. Ponerlo a 1 hacía que el trazo diera
 * la vuelta por fuera y el relleno arrancara en el extremo equivocado.
 */
function arco(desde: number, hasta: number, radio: number) {
  const a = punto(desde, radio)
  const b = punto(hasta, radio)
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${radio} ${radio} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
}

export function Medidor({
  valor,
  competencia,
}: {
  valor: number | null
  competencia: string
}) {
  const sinDato = valor === null || !Number.isFinite(valor)
  const v = sinDato ? 0 : Math.min(Math.max(valor, 0), 100)
  const nivel = nivelDe(v)
  const meta = sinDato ? null : metaDe(v)

  return (
    <figure className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full max-w-[200px]"
        role="img"
        aria-label={
          sinDato
            ? `${competencia}: sin resultados aún`
            : `${competencia}: ${v.toFixed(1).replace('.', ',')} por ciento, nivel ${nivel.nivel}`
        }
      >
        {/* Canal de fondo */}
        <path
          d={arco(0, 100, R)}
          fill="none"
          stroke="#E1E5EA"
          strokeWidth={GROSOR}
          strokeLinecap="butt"
        />

        {/* Relleno coloreado por nivel.
            Remate plano: con "round" el trazo se derrama por detrás del 0. */}
        {!sinDato && v > 0 && (
          <path
            d={arco(0, v, R)}
            fill="none"
            stroke={nivel.color}
            strokeWidth={GROSOR}
            strokeLinecap="butt"
          />
        )}

        {/* Marca gris de la meta del siguiente nivel, sobre el arco */}
        {meta?.meta != null && (
          <g>
            <line
              x1={punto(meta.meta, R - GROSOR / 2 - 3).x}
              y1={punto(meta.meta, R - GROSOR / 2 - 3).y}
              x2={punto(meta.meta, R + GROSOR / 2 + 3).x}
              y2={punto(meta.meta, R + GROSOR / 2 + 3).y}
              stroke="#6B7280"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <text
              x={punto(meta.meta, R + GROSOR / 2 + 12).x}
              y={punto(meta.meta, R + GROSOR / 2 + 12).y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-texto-secundario text-[9px]"
            >
              {meta.meta}
            </text>
          </g>
        )}

        {/* Extremos de la escala */}
        <text x={CX - R} y={CY + 14} textAnchor="middle" className="fill-texto-secundario text-[9px]">0</text>
        <text x={CX + R} y={CY + 14} textAnchor="middle" className="fill-texto-secundario text-[9px]">100</text>

        {/* Valor al centro.
            Con un decimal: redondear a entero hacía que 74,9 se mostrara
            como "75" junto a un badge "Satisfactorio", contradiciéndose. */}
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          className="fill-institucional text-[22px] font-semibold"
        >
          {sinDato ? '—' : v.toFixed(1).replace('.', ',')}
        </text>
        {!sinDato && (
          <text x={CX} y={CY + 8} textAnchor="middle" className="fill-texto-secundario text-[10px]">
            %
          </text>
        )}
      </svg>

      <figcaption className="mt-1 flex flex-col items-center gap-1 text-center">
        <span className="text-xs font-medium text-slate-700">{competencia}</span>
        <BadgeNivel valor={sinDato ? null : v} />
      </figcaption>
    </figure>
  )
}
