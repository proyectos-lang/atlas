import Link from 'next/link'
import { Search } from 'lucide-react'
import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { clienteServidor } from '@/lib/supabase/servidor'
import { cursos, estudiantes, grupos as gruposDe } from '@/lib/kpi/consultas'
import { EditorEstudiante } from './editor'

export const metadata = { title: 'Estudiantes · ATLAS' }

/**
 * Listado de estudiantes con un lápiz por fila para editarlos.
 *
 * Hasta ahora no había dónde ver ni corregir a un estudiante: llegaban por
 * carga de datos y un error en el nombre o el grupo no tenía arreglo
 * desde la aplicación. El listado respeta el alcance: un coordinador ve y
 * edita sólo los de su programa.
 */
export default async function PaginaEstudiantes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; curso?: string }>
}) {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador'], '/admin/estudiantes')
  const { q = '', curso = '' } = await searchParams

  const [listaEst, listaCursos, listaGrupos] = await Promise.all([
    estudiantes(alcance), cursos(alcance), gruposDe(alcance),
  ])

  // `estudiantes()` no trae el semestre; se pide aparte sólo para los visibles.
  const db = clienteServidor()
  const ids = listaEst.map((e) => e.id)
  const { data: extra } = ids.length
    ? await db.from('usuarios').select('id, semestre').in('id', ids)
    : { data: [] }
  const semestreDe = new Map((extra ?? []).map((u) => [Number(u.id), u.semestre == null ? null : Number(u.semestre)]))

  const nombreCurso = new Map(listaCursos.map((c) => [c.id, c.nombre]))
  const nombreGrupo = new Map(listaGrupos.map((g) => [g.id, g.nombre]))
  const opGrupos = listaGrupos.map((g) => ({
    id: g.id, etiqueta: `${nombreCurso.get(g.cursoId) ?? 'Curso'} — ${g.nombre}`,
  }))

  const busqueda = q.trim().toLowerCase()
  const cursoSel = curso ? Number(curso) : null
  const filtrados = listaEst.filter((e) =>
    (cursoSel === null || e.cursoId === cursoSel) &&
    (!busqueda || e.codigo.toLowerCase().includes(busqueda) || e.nombre.toLowerCase().includes(busqueda))
  )

  return (
    <Marco perfil={perfil} titulo="Estudiantes" lateral={<SubNavAdmin />}>
      <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-institucional">
              Estudiantes ({filtrados.length}{filtrados.length !== listaEst.length ? ` de ${listaEst.length}` : ''})
            </h2>
            <p className="mt-1 text-sm text-texto-secundario">
              Pulsa el lápiz para corregir código, nombre, semestre o grupo.
              Las cuentas de acceso de los estudiantes están en{' '}
              <Link href="/admin/perfiles" className="text-institucional underline underline-offset-2">
                Perfiles de acceso
              </Link>.
            </p>
          </div>

          <form className="flex flex-wrap items-center gap-2" role="search">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-secundario" aria-hidden />
              <input
                name="q" defaultValue={q} placeholder="Código o nombre"
                className="w-48 rounded-md border border-superficie-borde py-1.5 pl-8 pr-2.5 text-sm
                           outline-none focus:border-institucional focus:ring-2 focus:ring-institucional/20"
              />
            </div>
            <select
              name="curso" defaultValue={curso}
              className="rounded-md border border-superficie-borde px-2.5 py-1.5 text-sm outline-none
                         focus:border-institucional"
            >
              <option value="">Todos los cursos</option>
              {listaCursos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button
              type="submit"
              className="rounded-md bg-institucional px-3 py-1.5 text-sm font-medium text-white
                         transition hover:bg-institucional-claro"
            >
              Filtrar
            </button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                <th className="py-2 pr-3 font-medium">Código</th>
                <th className="py-2 pr-3 font-medium">Nombre</th>
                <th className="py-2 pr-3 font-medium">Curso</th>
                <th className="py-2 pr-3 font-medium">Grupo</th>
                <th className="py-2 pr-3 font-medium">Semestre</th>
                <th className="py-2 font-medium"><span className="sr-only">Editar</span></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-texto-secundario">
                    {listaEst.length === 0 ? 'No hay estudiantes en tu alcance.' : 'Ningún estudiante coincide con el filtro.'}
                  </td>
                </tr>
              )}
              {filtrados.map((e) => (
                <tr key={e.id} className="border-b border-superficie-borde/60 align-top">
                  <td className="py-2 pr-3 font-medium">{e.codigo}</td>
                  <td className="py-2 pr-3">{e.nombre}</td>
                  <td className="py-2 pr-3 text-texto-secundario">
                    {e.cursoId !== null ? nombreCurso.get(e.cursoId) ?? '—' : '—'}
                  </td>
                  <td className="py-2 pr-3 text-texto-secundario">
                    {e.grupoId !== null ? nombreGrupo.get(e.grupoId) ?? '—' : 'Sin grupo'}
                  </td>
                  <td className="py-2 pr-3 text-texto-secundario">{semestreDe.get(e.id) ?? '—'}</td>
                  <td className="py-2 text-right">
                    <EditorEstudiante
                      id={e.id}
                      codigo={e.codigo}
                      nombre={e.nombre}
                      semestre={semestreDe.get(e.id) ?? null}
                      grupoId={e.grupoId}
                      grupos={opGrupos}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Marco>
  )
}
