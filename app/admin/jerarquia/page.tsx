import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { clienteServidor } from '@/lib/supabase/servidor'
import { universidades, cursos, programas, grupos } from '@/lib/kpi/consultas'
import { FormularioPrograma, FormularioGrupo } from './formularios'
import { asignarDocente, alternarGrupo, moverCurso } from './acciones'

export const metadata = { title: 'Jerarquía académica · ATLAS' }

/**
 * Universidad → Programa → Curso → Grupo → docente.
 *
 * Reorganizar la jerarquía NO altera ningún indicador: los datos de hechos
 * cuelgan de estudiante y curso, no de estas tablas. Cambiar el programa de
 * un curso sólo cambia bajo qué rama aparece.
 */
export default async function PaginaJerarquia() {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador'], '/admin/jerarquia')

  const [listaUniv, listaProg, listaCursos, listaGrupos] = await Promise.all([
    universidades(alcance),
    programas(alcance),
    cursos(alcance),
    grupos(alcance),
  ])

  const db = clienteServidor()

  // Docentes y coordinadores pueden hacerse cargo de un grupo.
  const { data: perfilesDocentes } = await db
    .from('perfiles')
    .select('id, nombre, email, rol')
    .in('rol', ['docente', 'coordinador'])
    .eq('activo', true)
    .order('nombre')

  const docentes = (perfilesDocentes ?? []).map((d) => ({
    id: Number(d.id),
    etiqueta: String(d.nombre),
    pie: String(d.rol) === 'docente' ? 'Docente' : 'Coordinador',
  }))
  const nombreDocente = new Map(docentes.map((d) => [d.id, d.etiqueta]))

  // Cuántos estudiantes hay en cada grupo, para que el árbol tenga peso.
  const { data: estudiantes } = await db
    .from('usuarios').select('grupo_id').eq('rol', 'Estudiante')

  const porGrupo = new Map<number, number>()
  for (const e of estudiantes ?? []) {
    if (e.grupo_id == null) continue
    const k = Number(e.grupo_id)
    porGrupo.set(k, (porGrupo.get(k) ?? 0) + 1)
  }

  const faltaJerarquia = listaProg.length === 0 && listaGrupos.length === 0

  // Árbol: cada universidad con sus programas, cursos y grupos.
  const arbol = listaUniv.map((u) => ({
    ...u,
    programas: listaProg
      .filter((p) => p.universidadId === u.id)
      .map((p) => ({
        ...p,
        cursos: listaCursos
          .filter((c) => c.programaId === p.id)
          .map((c) => ({
            ...c,
            grupos: listaGrupos.filter((g) => g.cursoId === c.id),
          })),
      })),
  }))

  // Cursos que quedaron fuera de todo programa: se muestran aparte para
  // que no desaparezcan del árbol sin explicación.
  const idsEnArbol = new Set(
    arbol.flatMap((u) => u.programas.flatMap((p) => p.cursos.map((c) => c.id)))
  )
  const cursosHuerfanos = listaCursos.filter((c) => !idsEnArbol.has(c.id))

  return (
    <Marco perfil={perfil} titulo="Jerarquía académica" lateral={<SubNavAdmin />}>
      <div className="space-y-5">
        {faltaJerarquia && (
          <div className="rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Falta aplicar la migración
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              No hay programas ni grupos. Ejecuta{' '}
              <code>supabase/migraciones/08_jerarquia.sql</code> desde el SQL
              Editor de Supabase.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-lg font-semibold text-institucional">Crear programa</h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Un programa agrupa cursos dentro de una universidad y es el nivel
              al que pertenece el perfil de egreso.
            </p>
            <FormularioPrograma
              universidades={listaUniv.map((u) => ({
                id: u.id, etiqueta: u.universidad,
              }))}
            />
          </section>

          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-lg font-semibold text-institucional">Crear grupo</h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Un grupo es una sección de un curso, con su docente y sus
              estudiantes. Permite que dos docentes compartan curso sin verse.
            </p>
            <FormularioGrupo
              cursos={listaCursos.map((c) => ({
                id: c.id,
                etiqueta: `${c.nombre} (${c.codigo})`,
                pie: listaProg.find((p) => p.id === c.programaId)?.nombre,
              }))}
              docentes={docentes}
            />
          </section>
        </div>

        {/* ---------- El árbol ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Estructura actual
          </h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            {listaUniv.length} universidades · {listaProg.length} programas ·{' '}
            {listaCursos.length} cursos · {listaGrupos.length} grupos. Mover un
            curso de programa no altera ningún indicador.
          </p>

          <div className="space-y-4">
            {arbol.map((u) => (
              <div key={u.id} className="rounded-lg border border-superficie-borde p-4">
                <h3 className="text-sm font-semibold text-institucional">
                  {u.universidad}
                  <span className="ml-2 font-normal text-texto-secundario">
                    {u.codigo}
                  </span>
                </h3>

                {u.programas.length === 0 && (
                  <p className="mt-2 text-sm text-texto-secundario">
                    Sin programas todavía.
                  </p>
                )}

                {u.programas.map((p) => (
                  <div key={p.id} className="mt-3 border-l-2 border-institucional/20 pl-4">
                    <h4 className="text-sm font-medium text-slate-900">
                      {p.nombre}
                      <span className="ml-2 text-xs font-normal text-texto-secundario">
                        {p.codigo}{p.modalidad ? ` · ${p.modalidad}` : ''}
                      </span>
                    </h4>

                    {p.cursos.length === 0 && (
                      <p className="mt-1 text-xs text-texto-secundario">Sin cursos.</p>
                    )}

                    {p.cursos.map((c) => (
                      <div key={c.id} className="mt-2 border-l border-superficie-borde pl-4">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm text-slate-800">{c.nombre}</span>
                          <span className="text-xs text-texto-secundario">
                            {c.codigo} · {c.semanas} semanas
                          </span>
                        </div>

                        {c.grupos.length === 0 && (
                          <p className="mt-1 text-xs text-texto-secundario">
                            Sin grupos. Los estudiantes de este curso no aparecerán
                            al filtrar por grupo.
                          </p>
                        )}

                        <ul className="mt-1.5 space-y-1.5">
                          {c.grupos.map((g) => (
                            <li
                              key={g.id}
                              className="rounded-md bg-institucional-suave px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm text-slate-800">
                                  {g.nombre}
                                  <span className="ml-1.5 text-xs text-texto-secundario">
                                    {g.codigo} · {porGrupo.get(g.id) ?? 0} estudiantes
                                  </span>
                                </span>

                                <form action={alternarGrupo}>
                                  <input type="hidden" name="id" value={String(g.id)} />
                                  <input type="hidden" name="activo" value="true" />
                                  <button
                                    type="submit"
                                    className="text-xs text-institucional underline underline-offset-2"
                                  >
                                    Desactivar
                                  </button>
                                </form>
                              </div>

                              <form
                                action={asignarDocente}
                                className="mt-1.5 flex flex-wrap items-center gap-2"
                              >
                                <input type="hidden" name="grupo_id" value={String(g.id)} />
                                <label className="text-xs text-texto-secundario">
                                  Docente
                                </label>
                                <select
                                  name="docente_id"
                                  defaultValue={g.docenteId ?? ''}
                                  className="rounded-md border border-superficie-borde
                                             bg-white px-2 py-1 text-xs"
                                >
                                  <option value="">Sin asignar</option>
                                  {docentes.map((d) => (
                                    <option key={d.id} value={d.id}>{d.etiqueta}</option>
                                  ))}
                                </select>
                                <button
                                  type="submit"
                                  className="text-xs text-institucional underline underline-offset-2"
                                >
                                  Guardar
                                </button>
                                {g.docenteId !== null && (
                                  <span className="text-xs text-texto-secundario">
                                    actual: {nombreDocente.get(g.docenteId) ?? '—'}
                                  </span>
                                )}
                              </form>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {cursosHuerfanos.length > 0 && (
            <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">
                Cursos sin programa ({cursosHuerfanos.length})
              </h3>
              <p className="mt-1 text-sm text-amber-900">
                No aparecen al filtrar por programa. Asígnales uno:
              </p>
              <ul className="mt-2 space-y-2">
                {cursosHuerfanos.map((c) => (
                  <li key={c.id}>
                    <form action={moverCurso} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="curso_id" value={String(c.id)} />
                      <span className="text-sm text-amber-900">
                        {c.nombre} ({c.codigo})
                      </span>
                      <select
                        name="programa_id"
                        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs"
                      >
                        {listaProg.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="text-xs text-amber-900 underline underline-offset-2"
                      >
                        Asignar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </Marco>
  )
}
