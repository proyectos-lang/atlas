import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { clienteServidor } from '@/lib/supabase/servidor'
import { universidades, cursos as cursosDe, programas as programasDe } from '@/lib/kpi/consultas'
import { arbolCompetencias, areas as areasDe, resultados as resultadosDe } from '@/lib/curriculo/modelo'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'
import {
  FormularioInstitucion, FormularioFacultad, FormularioMacro,
  FormularioArea, FormularioLinea, FormularioUbicacion,
  FormularioMicro, FormularioUnidad, FormularioResultado,
  type FichaMacro, type FichaMicro,
} from './formularios'
import { enlazarIndicador, desenlazarIndicador } from './acciones'

export const metadata = { title: 'Modelo curricular · ATLAS' }

/**
 * Configuración curricular macro / meso / micro.
 *
 * Es el punto 1 del modelo, y el que sostiene la trazabilidad:
 *
 *   Macro → Meso → Micro → Resultado de aprendizaje → Competencia
 *     → Indicador → Evidencia
 *
 * Sin resultados de aprendizaje cargados, esa cadena está construida pero
 * vacía por el centro: se puede medir una competencia, pero no decir qué
 * resultado está en riesgo.
 */

type Fila = Record<string, unknown>

async function leer(tabla: string, columnas: string): Promise<Fila[]> {
  const db = clienteServidor()
  const { data, error } = await db.from(tabla).select(columnas)
  if (error) {
    if (faltaMigracion(error.code)) return []
    throw new Error(`${tabla}: ${error.message}`)
  }
  return (data ?? []) as unknown as Fila[]
}

export default async function PaginaCurriculo() {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador', 'asesor', 'docente'])

  const [
    listaUniv, listaProg, listaCursos, arbol, listaAreas, listaResultados,
    instituciones, facultades, lineas, macros, micros, unidades, enlaces,
  ] = await Promise.all([
    universidades(alcance),
    programasDe(alcance),
    cursosDe(alcance),
    arbolCompetencias(alcance),
    areasDe(alcance.programaIds),
    resultadosDe(alcance),
    leer('instituciones', 'id, codigo, nombre, siglas'),
    leer('facultades', 'id, codigo, nombre, institucion_id'),
    leer('lineas_curriculares', 'id, codigo, nombre, programa_id'),
    leer('programas_macro', '*'),
    leer('cursos_micro', '*'),
    leer('unidades', 'id, codigo, nombre, curso_id, semana_inicio, semana_fin'),
    leer('resultado_indicadores', 'resultado_id, indicador_id'),
  ])

  const faltaModelo = arbol.length === 0 && instituciones.length === 0

  const indicadores = arbol.flatMap((c) =>
    c.dimensiones.flatMap((d) =>
      d.indicadores.map((i) => ({
        id: i.id, nombre: i.nombre, competencia: c.nombre, dimension: d.nombre,
      }))
    )
  )
  const nombreIndicador = new Map(indicadores.map((i) => [i.id, i.nombre]))
  const nombreCompetencia = new Map(arbol.map((c) => [c.id, c.nombre]))
  const nombreCurso = new Map(listaCursos.map((c) => [c.id, c.nombre]))
  const nombrePrograma = new Map(listaProg.map((p) => [p.id, p.nombre]))
  const nombreArea = new Map(listaAreas.map((a) => [a.id, a.nombre]))

  const fichasMacro: FichaMacro[] = macros.map((m) => ({
    programaId: Number(m.programa_id),
    facultadId: m.facultad_id == null ? null : Number(m.facultad_id),
    perfilEgreso: m.perfil_egreso == null ? '' : String(m.perfil_egreso),
    propositos: m.propositos == null ? '' : String(m.propositos),
    planEstudios: m.plan_estudios == null ? '' : String(m.plan_estudios),
    modalidad: m.modalidad == null ? '' : String(m.modalidad),
    nivel: m.nivel == null ? '' : String(m.nivel),
    duracionSemestres: m.duracion_semestres == null ? null : Number(m.duracion_semestres),
    abetAdoptado: Boolean(m.abet_adoptado),
  }))

  const fichasMicro: FichaMicro[] = micros.map((m) => ({
    cursoId: Number(m.curso_id),
    descripcion: m.descripcion == null ? '' : String(m.descripcion),
    justificacion: m.justificacion == null ? '' : String(m.justificacion),
    metodologia: m.metodologia == null ? '' : String(m.metodologia),
    evaluacion: m.evaluacion == null ? '' : String(m.evaluacion),
  }))

  const indicadoresDe = (resultadoId: number) =>
    enlaces
      .filter((e) => Number(e.resultado_id) === resultadoId)
      .map((e) => Number(e.indicador_id))

  const opProgramas = listaProg.map((p) => ({ id: p.id, etiqueta: p.nombre }))
  const opCursos = listaCursos.map((c) => ({ id: c.id, etiqueta: c.nombre }))
  const opAreas = listaAreas.map((a) => ({ id: a.id, etiqueta: a.nombre }))

  return (
    <Marco perfil={perfil} titulo="Modelo curricular" lateral={<SubNavAdmin />}>
      <div className="space-y-5 pb-8">
        {faltaModelo && (
          <div className="rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Falta aplicar el modelo curricular
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Ejecuta <code>supabase/migraciones/09_curriculo.sql</code> desde
              el SQL Editor de Supabase.
            </p>
          </div>
        )}

        <div className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            La cadena de trazabilidad
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Lo que se configura aquí es lo que permite responder «qué resultado
            de aprendizaje está en riesgo», y no sólo «esta competencia va al
            62 %».
          </p>
          <p className="mt-2 font-mono text-xs text-texto-secundario">
            macro → meso → micro → resultado de aprendizaje → competencia → indicador → evidencia
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Instituciones', instituciones.length],
              ['Facultades', facultades.length],
              ['Áreas', listaAreas.length],
              ['Líneas', lineas.length],
              ['Unidades', unidades.length],
              ['Resultados', listaResultados.length],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg border border-superficie-borde p-3">
                <dt className="text-xs uppercase tracking-wide text-texto-secundario">{k}</dt>
                <dd className="mt-0.5 text-xl font-semibold text-institucional">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---------- RESULTADOS DE APRENDIZAJE ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Resultados de aprendizaje ({listaResultados.length})
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-texto-secundario">
            El eslabón central de la trazabilidad. Enlazar cada resultado con
            los indicadores que lo evidencian es lo que permite saber qué
            resultado está en riesgo cuando un indicador cae.
          </p>

          {listaResultados.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              Todavía no hay ninguno. Sin resultados de aprendizaje, la cadena
              queda vacía por el centro.
            </p>
          ) : (
            <ul className="space-y-3">
              {listaResultados.map((r) => {
                const enlazados = indicadoresDe(r.id)
                const ambito =
                  r.ambito === 'Programa'
                    ? nombrePrograma.get(r.programaId ?? 0)
                    : r.ambito === 'Area'
                      ? nombreArea.get(r.areaId ?? 0)
                      : nombreCurso.get(r.cursoId ?? 0)

                return (
                  <li key={r.id} className="rounded-lg border border-superficie-borde p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-medium text-slate-900">
                        {r.codigo}
                        <span className="ml-2 font-normal text-texto-secundario">
                          {r.ambito} · {ambito ?? '—'}
                        </span>
                      </h3>
                      {r.competenciaId !== null && (
                        <span className="rounded-full bg-institucional-suave px-2 py-0.5 text-xs text-institucional">
                          {nombreCompetencia.get(r.competenciaId) ?? ''}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-700">{r.enunciado}</p>

                    <div className="mt-3">
                      <span className="text-xs font-medium uppercase tracking-wide text-texto-secundario">
                        Indicadores que lo evidencian
                      </span>

                      {enlazados.length === 0 ? (
                        <p className="mt-1 text-xs text-amber-700">
                          Sin indicadores: este resultado no se puede medir.
                        </p>
                      ) : (
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {enlazados.map((id) => (
                            <li key={id}>
                              <form action={desenlazarIndicador} className="inline">
                                <input type="hidden" name="resultado_id" value={String(r.id)} />
                                <input type="hidden" name="indicador_id" value={String(id)} />
                                <button
                                  type="submit"
                                  title="Quitar este enlace"
                                  className="rounded-full bg-institucional-suave px-2 py-0.5
                                             text-xs text-institucional hover:line-through"
                                >
                                  {nombreIndicador.get(id) ?? id} ×
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}

                      {indicadores.length > 0 && (
                        <form action={enlazarIndicador} className="mt-2 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="resultado_id" value={String(r.id)} />
                          <select
                            name="indicador_id"
                            className="rounded-md border border-superficie-borde bg-white px-2 py-1 text-xs"
                          >
                            {indicadores
                              .filter((i) => !enlazados.includes(i.id))
                              .map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.nombre} — {i.dimension}
                                </option>
                              ))}
                          </select>
                          <button
                            type="submit"
                            className="text-xs text-institucional underline underline-offset-2"
                          >
                            Enlazar
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-5 border-t border-superficie-borde pt-5">
            <h3 className="text-base font-semibold text-institucional">
              Nuevo resultado de aprendizaje
            </h3>
            <div className="mt-3">
              <FormularioResultado
                programas={opProgramas}
                areas={opAreas}
                cursos={opCursos}
                competencias={arbol.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
              />
            </div>
          </div>
        </section>

        {/* ---------- MACRO ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">Macrocurricular</h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            Institución, facultad y los datos del programa: perfil de egreso,
            propósitos de formación y plan de estudios.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Institución</h3>
              {instituciones.length > 0 && (
                <ul className="mb-3 mt-2 space-y-1 text-sm text-texto-secundario">
                  {instituciones.map((i) => (
                    <li key={String(i.id)}>
                      {String(i.nombre)}
                      {i.siglas ? ` (${String(i.siglas)})` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <FormularioInstitucion
                  universidades={listaUniv.map((u) => ({
                    id: u.id, etiqueta: u.universidad,
                  }))}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800">Facultad</h3>
              {facultades.length > 0 && (
                <ul className="mb-3 mt-2 space-y-1 text-sm text-texto-secundario">
                  {facultades.map((f) => (
                    <li key={String(f.id)}>{String(f.nombre)}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <FormularioFacultad
                  instituciones={instituciones.map((i) => ({
                    id: Number(i.id), etiqueta: String(i.nombre),
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-superficie-borde pt-5">
            <h3 className="text-sm font-semibold text-slate-800">
              Datos macro del programa ({macros.length} de {listaProg.length} configurados)
            </h3>
            <div className="mt-3">
              <FormularioMacro
                programas={opProgramas}
                facultades={facultades.map((f) => ({
                  id: Number(f.id), etiqueta: String(f.nombre),
                }))}
                fichas={fichasMacro}
              />
            </div>
          </div>
        </section>

        {/* ---------- MESO ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">Mesocurricular</h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            Áreas de formación, líneas curriculares y dónde se ubica cada
            asignatura en el plan.
          </p>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Áreas ({listaAreas.length})
              </h3>
              {listaAreas.length > 0 && (
                <ul className="mb-3 mt-2 space-y-1 text-sm text-texto-secundario">
                  {listaAreas.map((a) => (
                    <li key={a.id}>{a.nombre}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <FormularioArea programas={opProgramas} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Líneas ({lineas.length})
              </h3>
              {lineas.length > 0 && (
                <ul className="mb-3 mt-2 space-y-1 text-sm text-texto-secundario">
                  {lineas.map((l) => (
                    <li key={String(l.id)}>{String(l.nombre)}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <FormularioLinea programas={opProgramas} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Ubicar asignatura
              </h3>
              <div className="mt-3">
                <FormularioUbicacion
                  cursos={opCursos}
                  areas={opAreas}
                  lineas={lineas.map((l) => ({
                    id: Number(l.id), etiqueta: String(l.nombre),
                  }))}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- MICRO ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">Microcurricular</h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            La ficha de cada asignatura y sus unidades o temas.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Ficha de la asignatura ({micros.length} de {listaCursos.length})
              </h3>
              <div className="mt-3">
                <FormularioMicro cursos={opCursos} fichas={fichasMicro} />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Unidades ({unidades.length})
              </h3>
              {unidades.length > 0 && (
                <ul className="mb-3 mt-2 space-y-1 text-sm text-texto-secundario">
                  {unidades.map((u) => (
                    <li key={String(u.id)}>
                      {String(u.codigo)} · {String(u.nombre)}
                      <span className="ml-1 text-xs">
                        {nombreCurso.get(Number(u.curso_id)) ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <FormularioUnidad cursos={opCursos} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </Marco>
  )
}
