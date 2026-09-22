import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { cursos as cursosDe } from '@/lib/kpi/consultas'
import { arbolCompetencias } from '@/lib/curriculo/modelo'
import {
  fuentes, mapeos, NOMBRE_CATEGORIA, NOMBRE_MODO,
  type CategoriaFuente,
} from '@/lib/evidencias/modelo'
import { FormularioMapeo, FormularioCarga } from './formularios'
import { alternarFuente, borrarMapeo } from './acciones'

export const metadata = { title: 'Fuentes de datos · ATLAS' }

/**
 * Fuentes de datos, mapeo e ingreso de evidencias.
 *
 *   Fuente → dato → evidencia → indicador → competencia → RA
 *
 * El LMS es una fuente más. Un curso presencial sin ninguna herramienta
 * digital registra evidencias por observación y produce los mismos
 * indicadores que uno con Moodle.
 */

const ORDEN_CATEGORIA: CategoriaFuente[] = [
  'LMS', 'Colaborativa', 'Codigo', 'Formulario',
  'Instrumento', 'Observacion', 'Archivo',
]

export default async function PaginaFuentes() {
  const { perfil, alcance } = await exigirRol(['admin', 'docente', 'coordinador'], '/admin/fuentes')

  const [listaFuentes, listaMapeos, listaCursos, arbol] = await Promise.all([
    fuentes(),
    mapeos(alcance.cursoIds),
    cursosDe(alcance),
    arbolCompetencias(alcance),
  ])

  const faltaCapa = listaFuentes.length === 0

  // Indicadores con su competencia, para elegir en los formularios.
  const indicadores = arbol.flatMap((c) =>
    c.dimensiones.flatMap((d) =>
      d.indicadores.map((i) => ({
        id: i.id,
        etiqueta: i.nombre,
        pie: `${c.nombre} · ${d.nombre}`,
      }))
    )
  )
  const nombreIndicador = new Map(indicadores.map((i) => [i.id, i.etiqueta]))
  const nombreFuente = new Map(listaFuentes.map((f) => [f.id, f.nombre]))
  const nombreCurso = new Map(listaCursos.map((c) => [c.id, c.nombre]))

  const porCategoria = ORDEN_CATEGORIA.map((cat) => ({
    categoria: cat,
    fuentes: listaFuentes.filter((f) => f.categoria === cat),
  })).filter((g) => g.fuentes.length > 0)

  const sinLms = listaFuentes.filter((f) => f.categoria !== 'LMS').length

  return (
    <Marco perfil={perfil} titulo="Fuentes de datos" lateral={<SubNavAdmin />}>
      <div className="space-y-5">
        {faltaCapa && (
          <div className="rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Falta aplicar la capa de evidencias
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              Ejecuta <code>supabase/migraciones/11_evidencias.sql</code> y{' '}
              <code>12_motor_evidencias.sql</code> desde el SQL Editor de
              Supabase.
            </p>
          </div>
        )}

        <div className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            De dónde vienen las evidencias
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            El LMS es <strong>una fuente más</strong>, no un requisito. Un curso
            presencial sin ninguna herramienta digital registra evidencias por
            observación del docente y produce los mismos indicadores.
          </p>
          <p className="mt-2 font-mono text-xs text-texto-secundario">
            fuente → dato → evidencia → indicador → competencia → resultado de aprendizaje
          </p>
          {!faltaCapa && (
            <p className="mt-3 text-sm text-texto-secundario">
              {listaFuentes.length} fuentes configuradas, {sinLms} de ellas sin
              depender de un LMS.
            </p>
          )}
        </div>

        {/* ---------- Catálogo de fuentes ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">Fuentes disponibles</h2>

          <div className="mt-4 space-y-4">
            {porCategoria.map((g) => (
              <div key={g.categoria}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-texto-secundario">
                  {NOMBRE_CATEGORIA[g.categoria]}
                </h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.fuentes.map((f) => (
                    <li
                      key={f.id}
                      className="rounded-lg border border-superficie-borde p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={
                              f.activo
                                ? 'block text-sm font-medium text-slate-900'
                                : 'block text-sm font-medium text-texto-secundario line-through'
                            }
                          >
                            {f.nombre}
                          </span>
                          <span className="mt-0.5 block text-xs text-texto-secundario">
                            {NOMBRE_MODO[f.modoIngreso]}
                          </span>
                        </div>
                        <form action={alternarFuente}>
                          <input type="hidden" name="id" value={String(f.id)} />
                          <input type="hidden" name="activo" value={String(f.activo)} />
                          <button
                            type="submit"
                            className="shrink-0 text-xs text-institucional underline underline-offset-2"
                          >
                            {f.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </form>
                      </div>
                      {f.descripcion && (
                        <p className="mt-1.5 text-xs text-texto-secundario">
                          {f.descripcion}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- Mapeos ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Mapeo entre fuente e indicador
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-texto-secundario">
            Declara qué variable de una fuente alimenta qué indicador. Es lo que
            permite añadir una herramienta nueva sin modificar la arquitectura.
          </p>

          {listaMapeos.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              Todavía no hay mapeos configurados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                    <th className="py-2 pr-3 font-medium">Fuente</th>
                    <th className="py-2 pr-3 font-medium">Variable</th>
                    <th className="py-2 pr-3 font-medium">Indicador</th>
                    <th className="py-2 pr-3 font-medium">Transformación</th>
                    <th className="py-2 pr-3 font-medium">Ámbito</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {listaMapeos.map((m) => (
                    <tr key={m.id} className="border-b border-superficie-borde/60">
                      <td className="py-2 pr-3">{nombreFuente.get(m.fuenteId) ?? '—'}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{m.variable}</td>
                      <td className="py-2 pr-3">
                        {nombreIndicador.get(m.indicadorId) ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-texto-secundario">
                        {m.transformacion}
                        {m.factor !== null && ` ×${m.factor}`}
                        {m.valorMaximo !== null && ` /${m.valorMaximo}`}
                      </td>
                      <td className="py-2 pr-3 text-texto-secundario">
                        {m.cursoId === null
                          ? 'Todos los cursos'
                          : nombreCurso.get(m.cursoId) ?? '—'}
                      </td>
                      <td className="py-2">
                        <form action={borrarMapeo}>
                          <input type="hidden" name="id" value={String(m.id)} />
                          <button
                            type="submit"
                            className="text-xs text-institucional underline underline-offset-2"
                          >
                            Quitar
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------- Formularios ---------- */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-base font-semibold text-institucional">Nuevo mapeo</h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Por ejemplo: GitHub · contribuciones → Participación → Trabajo en
              Equipo.
            </p>
            <FormularioMapeo
              fuentes={listaFuentes
                .filter((f) => f.activo)
                .map((f) => ({ id: f.id, etiqueta: f.nombre }))}
              indicadores={indicadores}
              cursos={listaCursos.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
            />
          </section>

          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-base font-semibold text-institucional">
              Cargar evidencias
            </h2>
            <p className="mb-4 mt-1 text-sm text-texto-secundario">
              Para cuando no hay integración: pega una planilla de observación,
              resultados de rúbrica o la exportación de cualquier herramienta.
            </p>
            <FormularioCarga
              fuentes={listaFuentes
                .filter((f) => f.activo)
                .map((f) => ({ id: f.id, etiqueta: f.nombre }))}
              indicadores={indicadores}
              cursos={listaCursos.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
            />
          </section>
        </div>
      </div>
    </Marco>
  )
}
