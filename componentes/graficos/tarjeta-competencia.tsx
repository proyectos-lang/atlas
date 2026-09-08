import { metaDe, nivelDe } from '@/lib/kpi/escala'
import { BadgeNivel } from './base'

/**
 * Tarjeta de competencia del estudiante (§8.6).
 * Nombre completo, porcentaje grande coloreado por nivel, badge, barra de
 * progreso y pie con la distancia a la meta.
 *
 * Meta intermedia: cuando faltan más de 8 puntos para el siguiente nivel,
 * se propone además un objetivo dentro del nivel actual, para que la meta
 * sea alcanzable y no sólo un salto de categoría.
 */
export function TarjetaCompetencia({
  competencia,
  valor,
  conAviso = false,
}: {
  competencia: string
  valor: number | null
  conAviso?: boolean
}) {
  const sinDato = valor === null || !Number.isFinite(valor)

  if (sinDato) {
    return (
      <div className="rounded-tarjeta border border-superficie-borde bg-white p-4">
        <p className="text-sm font-medium text-slate-700">{competencia}</p>
        <p className="mt-2 text-3xl font-semibold text-texto-secundario" aria-hidden>—</p>
        <p className="mt-1 text-xs text-texto-secundario">sin resultados aún</p>
      </div>
    )
  }

  const v = valor as number
  const nivel = nivelDe(v)
  const meta = metaDe(v)

  // Meta intermedia dentro del mismo nivel cuando el salto es grande.
  const intermedia =
    meta.faltan !== null && meta.faltan > 8
      ? Math.round((v + (meta.meta! - v) / 2) * 10) / 10
      : null

  return (
    <div className="rounded-tarjeta border border-superficie-borde bg-white p-4">
      <p className="text-sm font-medium text-slate-700">{competencia}</p>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold" style={{ color: nivel.color }}>
          {v.toFixed(1).replace('.', ',')} %
        </span>
        <BadgeNivel valor={v} />
      </div>

      {/* Barra de progreso, con la marca de la meta */}
      <div className="relative mt-3 h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full"
          style={{ width: `${v}%`, backgroundColor: nivel.color }}
        />
        {meta.meta !== null && (
          <span
            className="absolute top-[-3px] h-[14px] w-[2px] rounded bg-texto-secundario"
            style={{ left: `calc(${meta.meta}% - 1px)` }}
            aria-hidden
          />
        )}
      </div>

      <p className="mt-2 text-xs text-texto-secundario">
        {meta.texto}
        {conAviso && (
          <span className="ml-1 text-amber-700" title="Incluye indicadores de rúbrica simulada">
            · incluye datos simulados
          </span>
        )}
      </p>

      {intermedia !== null && (
        <p className="mt-0.5 text-xs text-texto-secundario">
          Meta intermedia: alcanzar {intermedia.toFixed(1).replace('.', ',')} % dentro
          del nivel {nivel.nivel}.
        </p>
      )}
    </div>
  )
}
