import { exigirSesion } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { cursos as cursosDe, estudiantes as estudiantesDe } from '@/lib/kpi/consultas'
import { arbolCompetencias } from '@/lib/curriculo/modelo'
import {
  intervenciones, efecto, ESTRATEGIAS,
  type EstadoIntervencion as Estado,
} from '@/lib/intervenciones/modelo'
import { FormularioIntervencion, BotonGenerar } from './formulario'
import { cambiarEstado, cerrarMedicion } from './acciones'

export const metadata = { title: 'Intervenciones · ATLAS' }

/**
 * Seguimiento de intervenciones didácticas.
 *
 *   Datos → Analítica → Recomendación → Intervención
 *     → Nueva evidencia → Nueva analítica
 *
 * Cierra el ciclo: registra qué hizo el docente y mide si cambió algo.
 */

const COLOR_ESTADO: Record<Estado, string> = {
  Planificada: 'bg-slate-100 text-slate-700',
  'En curso': 'bg-amber-100 text-amber-900',
  Completada: 'bg-green-100 text-green-900',
  Descartada: 'bg-slate-100 text-slate-500',
}

const pct = (v: number | null) =>
  v === null ? '—' : `${v.toFixed(1).replace('.', ',')} %`

export default async function PaginaIntervenciones() {
  const { perfil, alcance } = await exigirSesion('/intervenciones')

  const [lista, listaCursos, listaEst, arbol] = await Promise.all([
    intervenciones(alcance),
    cursosDe(alcance),
    estudiantesDe(alcance),
    arbolCompetencias(alcance),
  ])

  // El efecto de cada intervención completada, para la tabla.
  const efectos = new Map(
    await Promise.all(
      lista
        .filter((i) => i.estado === 'Completada')
        .map(async (i) => [i.id, await efecto(i.id)] as const)
    )
  )

  const codigoEst = new Map(listaEst.map((e) => [e.id, e.codigo]))
  const nombreCurso = new Map(listaCursos.map((c) => [c.id, c.nombre]))

  const dimensiones = arbol.flatMap((c) =>
    c.dimensiones.map((d) => ({ id: d.id, etiqueta: d.nombre, pie: c.nombre }))
  )
  const nombreDimension = new Map(dimensiones.map((d) => [d.id, d.etiqueta]))

  const indicadores = arbol.flatMap((c) =>
    c.dimensiones.flatMap((d) =>
      d.indicadores.map((i) => ({
        id: i.id, etiqueta: i.nombre, pie: `${c.nombre} · ${d.nombre}`,
      }))
    )
  )

  const puedeGenerar = ['asesor', 'admin', 'coordinador'].includes(perfil.rol)
  const faltaCapa = lista.length === 0 && arbol.length === 0

  return (
    <Marco perfil={perfil} titulo="Intervenciones">
      <div className="space-y-5 pb-8">
        <div className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            El ciclo de mejora
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Registrar qué se hizo es lo que permite saber si funcionó. Sin este
            paso, la analítica describe el problema pero nadie sabe qué se
            intentó ni con qué resultado.
          </p>
          <p className="mt-2 font-mono text-xs text-texto-secundario">
            datos → analítica → recomendación → intervención → nueva evidencia → nueva analítica
          </p>
        </div>

        {faltaCapa && (
          <div className="rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Falta aplicar la capa de intervenciones
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Ejecuta <code>supabase/migraciones/16_intervenciones.sql</code>{' '}
              desde el SQL Editor de Supabase.
            </p>
          </div>
        )}

        {/* ---------- Intervenciones registradas ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Intervenciones ({lista.length})
          </h2>

          {lista.length === 0 ? (
            <p className="mt-2 text-sm text-texto-secundario">
              Todavía no hay ninguna registrada.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {lista.map((i) => {
                const ef = efectos.get(i.id) ?? []
                return (
                  <li
                    key={i.id}
                    className="rounded-lg border border-superficie-borde p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900">{i.descripcion}</p>
                        <p className="mt-1 text-xs text-texto-secundario">
                          {nombreCurso.get(i.cursoId) ?? i.cursoId}
                          {i.usuarioId === null
                            ? ' · todo el curso'
                            : ` · ${codigoEst.get(i.usuarioId) ?? i.usuarioId}`}
                          {i.dimensionId !== null &&
                            ` · ${nombreDimension.get(i.dimensionId) ?? ''}`}
                          {i.estrategia && ` · ${i.estrategia}`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${COLOR_ESTADO[i.estado]}`}
                      >
                        {i.estado}
                      </span>
                    </div>

                    {/* Efecto medido */}
                    {ef.length > 0 && (
                      <div className="mt-3 rounded-md bg-institucional-suave px-3 py-2">
                        {ef.map((e) => (
                          <div key={e.indicadorId} className="text-xs">
                            <span className="font-medium text-slate-800">
                              {e.indicador}
                            </span>
                            <span className="ml-2 text-texto-secundario">
                              {pct(e.valorAntes)} → {pct(e.valorDespues)}
                              {e.cambio !== null && (
                                <strong
                                  className={
                                    e.cambio > 0 ? ' text-green-700' : ' text-red-700'
                                  }
                                >
                                  {' '}
                                  {e.cambio > 0 ? '+' : ''}
                                  {e.cambio.toFixed(1).replace('.', ',')} puntos
                                </strong>
                              )}
                            </span>
                            <span className="ml-2 text-texto-secundario">
                              ({e.evidenciasAntes} evidencia(s) antes,{' '}
                              {e.evidenciasDespues} después)
                            </span>
                            {e.evidenciasDespues < 3 && (
                              <span className="ml-1 text-amber-700">
                                · pocas evidencias para concluir
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {i.estado === 'Completada' && ef.length === 0 && (
                      <p className="mt-2 text-xs text-texto-secundario">
                        Sin evidencias posteriores: no hay con qué medir el efecto.
                      </p>
                    )}

                    {/* Acciones */}
                    <div className="mt-3 flex flex-wrap gap-3">
                      {i.estado === 'Planificada' && (
                        <form action={cambiarEstado}>
                          <input type="hidden" name="id" value={String(i.id)} />
                          <input type="hidden" name="estado" value="En curso" />
                          <button
                            type="submit"
                            className="text-xs text-institucional underline underline-offset-2"
                          >
                            Marcar en curso
                          </button>
                        </form>
                      )}
                      {i.estado === 'En curso' && (
                        <form action={cerrarMedicion}>
                          <input type="hidden" name="id" value={String(i.id)} />
                          <button
                            type="submit"
                            className="text-xs text-institucional underline underline-offset-2"
                          >
                            Cerrar y medir efecto
                          </button>
                        </form>
                      )}
                      {i.estado !== 'Descartada' && i.estado !== 'Completada' && (
                        <form action={cambiarEstado}>
                          <input type="hidden" name="id" value={String(i.id)} />
                          <input type="hidden" name="estado" value="Descartada" />
                          <button
                            type="submit"
                            className="text-xs text-texto-secundario underline underline-offset-2"
                          >
                            Descartar
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* ---------- Formularios ---------- */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-base font-semibold text-institucional">
              Registrar una intervención
            </h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Puede venir de una recomendación o de tu propio criterio. El valor
              del indicador se captura ahora, para poder comparar después.
            </p>
            <FormularioIntervencion
              cursos={listaCursos.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
              estudiantes={listaEst.map((e) => ({ id: e.id, etiqueta: e.codigo }))}
              dimensiones={dimensiones}
              indicadores={indicadores}
              estrategias={ESTRATEGIAS}
            />
          </section>

          {puedeGenerar && (
            <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
              <h2 className="text-base font-semibold text-institucional">
                Recomendaciones sobre dificultades
              </h2>
              <p className="mb-4 mt-1 text-sm text-texto-secundario">
                El agente recibe la dimensión concreta y el patrón que detectó
                la analítica, no un índice general. Necesita evidencias
                cargadas.
              </p>
              <BotonGenerar
                estudiantes={listaEst.map((e) => ({ id: e.id, etiqueta: e.codigo }))}
              />
            </section>
          )}
        </div>
      </div>
    </Marco>
  )
}
