import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { clienteServidor } from '@/lib/supabase/servidor'
import { cursos, estudiantes, universidades, programas, grupos as gruposDeCurso } from '@/lib/kpi/consultas'
import { FormularioPerfil } from './formulario'
import { alternarActivo } from './acciones'
import { EditorModulos } from './editor-modulos'
import { catalogoModulos } from '@/lib/auth/navegacion'
import { RUTAS_POR_ROL, type Rol } from '@/lib/auth/alcance'

export const metadata = { title: 'Perfiles · ATLAS' }

const NOMBRE_ROL: Record<string, string> = {
  admin: 'Administrador institucional',
  coordinador: 'Coordinador académico',
  asesor: 'Asesor pedagógico',
  docente: 'Docente',
  estudiante: 'Estudiante',
}

export default async function PaginaPerfiles() {
  const { perfil, alcance } = await exigirRol(['admin'])

  const [listaUniv, listaCursos, listaEst, listaProg, listaGrupos] = await Promise.all([
    universidades(alcance), cursos(alcance), estudiantes(alcance),
    programas(alcance), gruposDeCurso(alcance),
  ])

  const db = clienteServidor()
  const { data: perfiles } = await db
    .from('perfiles')
    .select('id, nombre, email, rol, universidad_id, curso_id, usuario_id, activo, modulos')
    .order('id')

  // Catálogo de módulos y el valor por defecto de cada rol, para el selector.
  const grupos = catalogoModulos().map((g) => ({
    titulo: g.titulo,
    items: g.items.map((i) => ({ ruta: i.ruta, etiqueta: i.etiqueta, pie: i.pie })),
  }))
  const modulosPorRol = Object.fromEntries(
    Object.entries(RUTAS_POR_ROL).map(([rol, rutas]) => [rol, [...rutas]])
  ) as Record<string, string[]>

  const nombreUniv = new Map(listaUniv.map((u) => [u.id, u.universidad]))
  const nombreCurso = new Map(listaCursos.map((c) => [c.id, c.nombre]))
  const nombreEst = new Map(listaEst.map((e) => [e.id, e.codigo]))

  const ambitoDe = (p: {
    rol: string; universidad_id: number | null
    curso_id: number | null; usuario_id: number | null
  }) => {
    if (p.rol === 'admin') return 'Todas las universidades'
    if (p.usuario_id !== null) return nombreEst.get(Number(p.usuario_id)) ?? '—'
    if (p.curso_id !== null) return nombreCurso.get(Number(p.curso_id)) ?? '—'
    if (p.universidad_id !== null) return nombreUniv.get(Number(p.universidad_id)) ?? '—'
    return 'sin alcance asignado'
  }

  return (
    <Marco perfil={perfil} titulo="Administración de perfiles" lateral={<SubNavAdmin />}>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">Crear perfil</h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            El alcance determina qué datos verá. Un rol restringido sin ámbito
            asignado no verá nada.
          </p>
          <FormularioPerfil
            universidades={listaUniv.map((u) => ({
              id: u.id, etiqueta: `${u.universidad} — ${u.programa}`,
            }))}
            cursos={listaCursos.map((c) => ({
              id: c.id, etiqueta: `${c.nombre} (${c.codigo})`,
            }))}
            estudiantes={listaEst.map((e) => ({ id: e.id, etiqueta: e.codigo }))}
            programas={listaProg.map((p) => ({ id: p.id, etiqueta: p.nombre }))}
            gruposCurso={listaGrupos.map((g) => ({
              id: g.id, etiqueta: `${g.nombre} (${g.codigo})`,
            }))}
            grupos={grupos}
            modulosPorRol={modulosPorRol}
          />
        </section>

        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Perfiles existentes ({perfiles?.length ?? 0})
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                  <th className="py-2 pr-3 font-medium">Nombre</th>
                  <th className="py-2 pr-3 font-medium">Rol</th>
                  <th className="py-2 pr-3 font-medium">Alcance</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {(perfiles ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-texto-secundario">
                      Todavía no hay perfiles.
                    </td>
                  </tr>
                )}
                {(perfiles ?? []).map((p) => (
                  <tr key={String(p.id)} className="border-b border-superficie-borde/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{String(p.nombre)}</div>
                      <div className="text-xs text-texto-secundario">{String(p.email)}</div>
                      <EditorModulos
                        perfilId={Number(p.id)}
                        nombre={String(p.nombre).split(' ')[0]}
                        grupos={grupos}
                        porDefecto={modulosPorRol[String(p.rol)] ?? []}
                        seleccionActual={
                          Array.isArray(p.modulos)
                            ? (p.modulos as string[]).map(String)
                            : (RUTAS_POR_ROL[p.rol as Rol] ?? []).map(String)
                        }
                        personalizado={Array.isArray(p.modulos)}
                      />
                    </td>
                    <td className="py-2 pr-3">{NOMBRE_ROL[String(p.rol)] ?? String(p.rol)}</td>
                    <td className="py-2 pr-3 text-texto-secundario">{ambitoDe(p as never)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          p.activo
                            ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                        }
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-2">
                      <form action={alternarActivo}>
                        <input type="hidden" name="id" value={String(p.id)} />
                        <input type="hidden" name="activo" value={String(p.activo)} />
                        <button
                          type="submit"
                          className="text-xs text-institucional underline underline-offset-2"
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Marco>
  )
}
