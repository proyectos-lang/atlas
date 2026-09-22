import { nivelDe } from '@/lib/kpi/escala'
import type { FilaDescriptiva, FilaDiagnostica } from '@/lib/analitica/modelo'

/**
 * Panel de competencias sobre el modelo de dimensiones.
 *
 * Es lo que los tableros por rol añaden a sus gráficos existentes. No los
 * reemplaza: esos leen del motor anterior y siguen siendo la fuente de
 * las cifras verificadas mientras no haya evidencias cargadas.
 *
 * Lo que aporta frente a un índice general: dice QUÉ dimensión falla, no
 * sólo cuánto. «Depuración 35 %» es accionable; «Resolución de Problemas
 * 62 %» obliga a adivinar dónde está el problema.
 */

const pct = (v: number) => `${v.toFixed(1).replace('.', ',')} %`

export interface ResumenCompetencia {
  competenciaId: number
  competencia: string
  valor: number
  dimensiones: {
    id: number
    nombre: string
    valor: number
    evidencias: number
    afectados: number
    total: number
  }[]
}

/**
 * Agrupa la analítica descriptiva en competencias con sus dimensiones.
 *
 * La competencia es el promedio de sus dimensiones, y cada dimensión el
 * promedio de los estudiantes medidos. Se hace en dos pasos: promediar
 * todo de golpe daría más peso a las dimensiones con más estudiantes.
 */
export function resumirCompetencias(
  descriptiva: FilaDescriptiva[],
  diagnostica: FilaDiagnostica[] = []
): ResumenCompetencia[] {
  const porDimension = new Map<
    number,
    { competenciaId: number; competencia: string; nombre: string; valores: number[]; evidencias: number }
  >()

  for (const d of descriptiva) {
    const previo = porDimension.get(d.dimensionId)
    porDimension.set(d.dimensionId, {
      competenciaId: d.competenciaId,
      competencia: d.competencia,
      nombre: d.dimension,
      valores: [...(previo?.valores ?? []), d.valor],
      evidencias: (previo?.evidencias ?? 0) + d.evidencias,
    })
  }

  // Cuántos estudiantes están por debajo de 60 en cada dimensión: es lo
  // que distingue un problema extendido de uno puntual.
  const afectados = new Map<number, { bajos: number; total: number }>()
  for (const d of diagnostica) {
    const previo = afectados.get(d.dimensionId) ?? { bajos: 0, total: 0 }
    afectados.set(d.dimensionId, {
      bajos: previo.bajos + (d.valor < 60 ? 1 : 0),
      total: previo.total + 1,
    })
  }

  const porCompetencia = new Map<number, ResumenCompetencia>()

  for (const [dimensionId, d] of porDimension) {
    const media = d.valores.reduce((t, x) => t + x, 0) / d.valores.length
    const a = afectados.get(dimensionId) ?? { bajos: 0, total: d.valores.length }

    const previo = porCompetencia.get(d.competenciaId)
    const dimension = {
      id: dimensionId,
      nombre: d.nombre,
      valor: media,
      evidencias: d.evidencias,
      afectados: a.bajos,
      total: a.total,
    }

    porCompetencia.set(d.competenciaId, {
      competenciaId: d.competenciaId,
      competencia: d.competencia,
      valor: 0,
      dimensiones: [...(previo?.dimensiones ?? []), dimension],
    })
  }

  return [...porCompetencia.values()]
    .map((c) => ({
      ...c,
      valor: c.dimensiones.reduce((t, d) => t + d.valor, 0) / c.dimensiones.length,
      dimensiones: [...c.dimensiones].sort((a, b) => a.valor - b.valor),
    }))
    .sort((a, b) => a.valor - b.valor)
}

export function PanelCompetencias({
  resumen,
  titulo = 'Competencias por dimensión',
  pie,
}: {
  resumen: ResumenCompetencia[]
  titulo?: string
  pie?: string
}) {
  if (resumen.length === 0) {
    return (
      <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
        <h2 className="text-lg font-semibold text-institucional">{titulo}</h2>
        <p className="mt-2 text-sm text-texto-secundario">
          Todavía no hay evidencias registradas. Este panel se calcula sobre
          ellas, no sobre las calificaciones.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
      <h2 className="text-lg font-semibold text-institucional">{titulo}</h2>
      {pie && <p className="mb-4 mt-1 text-sm text-texto-secundario">{pie}</p>}

      <div className="mt-4 space-y-4">
        {resumen.map((c) => {
          const n = nivelDe(c.valor)
          return (
            <article
              key={c.competenciaId}
              className="rounded-lg border border-superficie-borde p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-institucional">
                  {c.competencia}
                </h3>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: n.color, color: n.colorTexto }}
                >
                  {pct(c.valor)} · {n.nivel}
                </span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {c.dimensiones.map((d) => {
                  const nd = nivelDe(d.valor)
                  const extendido = d.total > 0 && d.afectados / d.total > 0.4

                  return (
                    <li key={d.id} className="flex items-center gap-3">
                      <span className="w-44 shrink-0 truncate text-sm text-slate-800">
                        {d.nombre}
                      </span>

                      {/* Barra proporcional: el ancho es el valor. */}
                      <span className="h-2 min-w-0 flex-1 rounded-full bg-superficie-borde">
                        <span
                          className="block h-2 rounded-full"
                          style={{
                            width: `${Math.max(Math.min(d.valor, 100), 2)}%`,
                            backgroundColor: nd.color,
                          }}
                        />
                      </span>

                      <span className="w-16 shrink-0 text-right text-xs text-slate-700">
                        {pct(d.valor)}
                      </span>

                      <span className="w-40 shrink-0 text-xs text-texto-secundario">
                        {extendido ? (
                          <span className="text-amber-700">
                            {d.afectados} de {d.total} por debajo
                          </span>
                        ) : (
                          `${d.evidencias} evidencia(s)`
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
