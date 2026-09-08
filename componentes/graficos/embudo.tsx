import type { EtapaEmbudo } from '@/lib/kpi/indicadores'
import { mayorCaida } from '@/lib/kpi/indicadores'

/**
 * Embudo de progresión académica (§6.6).
 * Muestra la conversión entre etapas y resalta en rojo la mayor caída,
 * calculada dinámicamente. El subtítulo explica el criterio de cada etapa.
 */

const ANCHO = 520
const ALTO_ETAPA = 46
const SEPARACION = 8

export function Embudo({ etapas }: { etapas: EtapaEmbudo[] }) {
  if (etapas.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  const maximo = Math.max(...etapas.map((e) => e.conteo), 1)
  const peor = mayorCaida(etapas)
  const alto = etapas.length * (ALTO_ETAPA + SEPARACION)

  return (
    <div>
      <svg
        viewBox={`0 0 ${ANCHO} ${alto}`}
        className="w-full"
        role="img"
        aria-label={`Embudo de progresión: ${etapas
          .map((e) => `${e.nombre} ${e.conteo}`)
          .join('; ')}`}
      >
        {etapas.map((e, i) => {
          const ancho = Math.max((e.conteo / maximo) * (ANCHO - 190), 3)
          const y = i * (ALTO_ETAPA + SEPARACION)
          const esPeor = i === peor
          return (
            <g key={e.etapa}>
              {/* Barra de la etapa */}
              <rect
                x={0}
                y={y}
                width={ancho}
                height={ALTO_ETAPA}
                rx={4}
                fill={esPeor ? '#C0392B' : '#2E86DE'}
                opacity={esPeor ? 1 : 0.85 - i * 0.06}
              />
              {/* Conteo dentro de la barra si cabe, fuera si no */}
              <text
                x={ancho > 44 ? ancho - 10 : ancho + 8}
                y={y + ALTO_ETAPA / 2}
                textAnchor={ancho > 44 ? 'end' : 'start'}
                dominantBaseline="central"
                className={
                  ancho > 44
                    ? 'fill-white text-[15px] font-semibold'
                    : 'fill-institucional text-[15px] font-semibold'
                }
              >
                {e.conteo}
              </text>
              {/* Nombre de la etapa y conversión */}
              <text
                x={ANCHO - 180}
                y={y + ALTO_ETAPA / 2 - 6}
                dominantBaseline="central"
                className="fill-slate-700 text-[11px]"
              >
                {e.nombre}
              </text>
              {e.conversion !== null && (
                <text
                  x={ANCHO - 180}
                  y={y + ALTO_ETAPA / 2 + 8}
                  dominantBaseline="central"
                  className={
                    esPeor
                      ? 'fill-[#C0392B] text-[10px] font-semibold'
                      : 'fill-texto-secundario text-[10px]'
                  }
                >
                  {e.conversion.toFixed(0)} % de la etapa anterior
                  {esPeor ? ' · mayor caída' : ''}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <dl className="mt-3 space-y-1 border-t border-superficie-borde pt-3 text-[11px] text-texto-secundario">
        {etapas.map((e) => (
          <div key={e.etapa} className="flex gap-2">
            <dt className="shrink-0 font-medium text-slate-600">{e.nombre}:</dt>
            <dd>{e.criterio}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
