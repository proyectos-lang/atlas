import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { arbolCompetencias } from '@/lib/curriculo/modelo'
import {
  FormularioCompetencia, FormularioDimension, FormularioIndicador,
} from './formularios'
import { alternarIndicador, alternarDimension } from './acciones'

export const metadata = { title: 'Competencias e indicadores · ATLAS' }

/**
 * Competencia → dimensión → indicador.
 *
 * Una competencia no se mide de golpe: se descompone en dimensiones
 * observables, y cada dimensión se mide con indicadores configurables.
 * Es la estructura que pide el modelo de la investigación, frente a
 * evaluar una competencia con una sola calificación general.
 */

const ETIQUETA_AGREGACION: Record<string, string> = {
  Promedio: 'promedio de los valores',
  Suma: 'suma sobre el valor esperado',
  Proporcion: 'proporción sobre el umbral',
  Conteo: 'número de evidencias',
  Rubrica: 'obtenido sobre máximo',
}

export default async function PaginaCompetencias() {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador'])

  const arbol = await arbolCompetencias(alcance)
  const faltaModelo = arbol.length === 0

  const dimensiones = arbol.flatMap((c) =>
    c.dimensiones.map((d) => ({
      id: d.id,
      etiqueta: d.nombre,
      pie: c.nombre,
    }))
  )

  const totalDim = arbol.reduce((t, c) => t + c.dimensiones.length, 0)
  const totalInd = arbol.reduce(
    (t, c) => t + c.dimensiones.reduce((s, d) => s + d.indicadores.length, 0),
    0
  )

  return (
    <Marco perfil={perfil} titulo="Competencias e indicadores" lateral={<SubNavAdmin />}>
      <div className="space-y-5">
        {faltaModelo && (
          <div className="rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Falta aplicar el modelo curricular
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Ejecuta <code>supabase/migraciones/09_curriculo.sql</code> y después{' '}
              <code>10_seed_competencias.sql</code> desde el SQL Editor de
              Supabase. La segunda siembra las cinco competencias con sus
              dimensiones e indicadores de partida.
            </p>
          </div>
        )}

        <div className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Cómo se estructura la medición
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Una competencia no se evalúa con una calificación general. Se
            descompone en <strong>dimensiones</strong> observables, y cada
            dimensión se mide con uno o más <strong>indicadores</strong> que
            dicen qué dato los alimenta y cómo se agrega.
          </p>
          <p className="mt-2 font-mono text-xs text-texto-secundario">
            competencia → dimensión → indicador → evidencia → dato → nivel de logro
          </p>
        </div>

        {/* ---------- El árbol ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Estructura actual
          </h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            {arbol.length} competencias · {totalDim} dimensiones · {totalInd} indicadores
          </p>

          <div className="space-y-4">
            {arbol.map((c) => (
              <article key={c.id} className="rounded-lg border border-superficie-borde p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-institucional">
                    {c.nombre}
                    <span className="ml-2 font-normal text-texto-secundario">{c.codigo}</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {c.transversal && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        Transversal
                      </span>
                    )}
                    {c.studentOutcome ? (
                      <span className="rounded-full bg-institucional-suave px-2 py-0.5 text-xs text-institucional">
                        ABET {c.studentOutcome}
                      </span>
                    ) : (
                      c.transversal && (
                        <span
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                          title="Se trabaja en el programa pero no corresponde a un Student Outcome directo"
                        >
                          Complementaria
                        </span>
                      )
                    )}
                  </div>
                </div>

                {c.descripcion && (
                  <p className="mt-1 text-sm text-slate-600">{c.descripcion}</p>
                )}

                {c.dimensiones.length === 0 && (
                  <p className="mt-2 text-sm text-texto-secundario">
                    Sin dimensiones. Esta competencia todavía no se puede medir.
                  </p>
                )}

                <div className="mt-3 space-y-2">
                  {c.dimensiones.map((d) => (
                    <div
                      key={d.id}
                      className="border-l-2 border-institucional/20 pl-4"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4
                          className={
                            d.activo
                              ? 'text-sm font-medium text-slate-900'
                              : 'text-sm font-medium text-texto-secundario line-through'
                          }
                        >
                          {d.nombre}
                          <span className="ml-2 text-xs font-normal text-texto-secundario">
                            {d.codigo}
                          </span>
                        </h4>
                        <form action={alternarDimension}>
                          <input type="hidden" name="id" value={String(d.id)} />
                          <input type="hidden" name="activo" value={String(d.activo)} />
                          <button
                            type="submit"
                            className="text-xs text-institucional underline underline-offset-2"
                          >
                            {d.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </form>
                      </div>

                      {d.descripcion && (
                        <p className="mt-0.5 text-xs text-texto-secundario">{d.descripcion}</p>
                      )}

                      {d.indicadores.length === 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          Sin indicador: esta dimensión no produce ninguna medida.
                        </p>
                      )}

                      <ul className="mt-1.5 space-y-1">
                        {d.indicadores.map((i) => (
                          <li
                            key={i.id}
                            className="flex flex-wrap items-center justify-between gap-2
                                       rounded-md bg-institucional-suave px-3 py-1.5"
                          >
                            <span className="min-w-0">
                              <span
                                className={
                                  i.activo
                                    ? 'text-sm text-slate-800'
                                    : 'text-sm text-texto-secundario line-through'
                                }
                              >
                                {i.nombre}
                              </span>
                              <span className="ml-2 text-xs text-texto-secundario">
                                {ETIQUETA_AGREGACION[i.agregacion] ?? i.agregacion}
                                {i.valorEsperado !== null && ` · esperado ${i.valorEsperado}`}
                                {i.umbral !== null && ` · umbral ${i.umbral}`}
                                {i.escala === 'Puntos' && ' · en puntos'}
                                {i.prorratea && ' · se prorratea'}
                              </span>
                            </span>

                            <form action={alternarIndicador}>
                              <input type="hidden" name="id" value={String(i.id)} />
                              <input type="hidden" name="activo" value={String(i.activo)} />
                              <button
                                type="submit"
                                className="text-xs text-institucional underline underline-offset-2"
                              >
                                {i.activo ? 'Desactivar' : 'Activar'}
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Formularios ---------- */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-base font-semibold text-institucional">Nueva competencia</h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Además de las cinco transversales, un programa puede añadir las
              suyas.
            </p>
            <FormularioCompetencia />
          </section>

          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-base font-semibold text-institucional">Nueva dimensión</h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Lo observable dentro de una competencia: comprensión del
              problema, depuración, coordinación…
            </p>
            <FormularioDimension
              competencias={arbol.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
            />
          </section>

          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-base font-semibold text-institucional">Nuevo indicador</h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Cómo se mide una dimensión a partir de las evidencias
              registradas.
            </p>
            <FormularioIndicador dimensiones={dimensiones} />
          </section>
        </div>
      </div>
    </Marco>
  )
}
