import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { clienteServidor } from '@/lib/supabase/servidor'
import { universidades, programas } from '@/lib/kpi/consultas'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'
import { FormularioPerfilEgreso, type ProgramaOpcion } from './formulario'
import { alternarActivoEgreso } from './acciones'

export const metadata = { title: 'Perfil de egreso · ATLAS' }

interface FilaEgreso {
  id: number
  programa_id: number | null
  universidad_id: number
  perfil_egreso: string
  notas: string | null
  activo: boolean
}

/**
 * Perfil de egreso por programa.
 *
 * Lista los PROGRAMAS de la tabla `programas`, etiquetados con su
 * universidad. Antes listaba universidades y leía el programa de una
 * columna de texto obsoleta: en cuanto se creaba o renombraba un
 * programa, los nombres dejaban de corresponder.
 */
export default async function PaginaPerfilEgreso() {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador'], '/admin/perfil-egreso')

  const [listaUniv, listaProg] = await Promise.all([
    universidades(alcance),
    programas(alcance),
  ])

  const db = clienteServidor()
  const { data, error } = await db
    .from('perfiles_egreso')
    .select('id, programa_id, universidad_id, perfil_egreso, notas, activo')

  const faltaTabla = faltaMigracion(error?.code)
  const filas = (data ?? []) as unknown as FilaEgreso[]

  const porPrograma = new Map(
    filas.filter((f) => f.programa_id !== null).map((f) => [Number(f.programa_id), f])
  )

  // Perfiles guardados con el formulario antiguo: tienen universidad pero
  // no programa. No se les asigna uno al azar; se avisa para que alguien
  // decida a cuál pertenecen.
  const huerfanos = filas.filter((f) => f.programa_id === null)

  const nombreUniv = new Map(listaUniv.map((u) => [u.id, u.universidad]))

  const opciones: ProgramaOpcion[] = listaProg.map((p) => {
    const fila = porPrograma.get(p.id)
    return {
      id: p.id,
      etiqueta: `${nombreUniv.get(p.universidadId) ?? 'Universidad'} — ${p.nombre}`,
      perfilEgreso: fila?.perfil_egreso ?? '',
      notas: fila?.notas ?? '',
      activo: fila?.activo ?? true,
    }
  })

  const conPerfil = opciones.filter((p) => p.perfilEgreso).length

  return (
    <Marco perfil={perfil} titulo="Perfil de egreso" lateral={<SubNavAdmin />}>
      {faltaTabla && (
        <div className="mb-5 rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Falta aplicar la migración</h2>
          <p className="mt-1 text-sm text-amber-900">
            La tabla <code>atlas.perfiles_egreso</code> todavía no existe. Ejecuta{' '}
            <code>supabase/migraciones/06_perfil_egreso.sql</code> desde el SQL
            Editor de Supabase.
          </p>
        </div>
      )}

      {huerfanos.length > 0 && (
        <div className="mb-5 rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            {huerfanos.length} perfil(es) de egreso sin programa asignado
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            Se guardaron cuando el perfil se colgaba de la universidad. Elige
            el programa correspondiente abajo y vuelve a guardarlo; el texto
            anterior era:
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {huerfanos.map((h) => (
              <li key={h.id}>
                <strong>{nombreUniv.get(h.universidad_id) ?? `Universidad ${h.universidad_id}`}:</strong>{' '}
                {h.perfil_egreso.slice(0, 160)}{h.perfil_egreso.length > 160 ? '…' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">Configurar perfil de egreso</h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            El perfil de egreso declara qué debe saber hacer quien termina el
            programa. El agente de IA lo recibe como contexto al redactar cada
            recomendación, de modo que la acción propuesta apunte a lo que el
            programa promete formar y no sólo a subir un indicador.
          </p>
          <FormularioPerfilEgreso programas={opciones} />
        </section>

        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Programas ({conPerfil} de {opciones.length} configurados)
          </h2>
          <p className="mb-3 mt-1 text-sm text-texto-secundario">
            Un programa sin perfil de egreso no rompe nada: el agente sigue
            trabajando sólo con los indicadores.
          </p>

          <ul className="space-y-3">
            {opciones.map((p) => {
              const fila = porPrograma.get(p.id)
              return (
                <li key={p.id} className="rounded-md border border-superficie-borde/80 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{p.etiqueta}</div>
                      {p.perfilEgreso ? (
                        <p className="mt-1 line-clamp-3 text-xs text-texto-secundario">
                          {p.perfilEgreso}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-texto-secundario">Sin perfil de egreso.</p>
                      )}
                    </div>

                    <span
                      className={
                        !p.perfilEgreso
                          ? 'shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                          : p.activo
                            ? 'shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800'
                            : 'shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                      }
                    >
                      {!p.perfilEgreso ? 'Sin definir' : p.activo ? 'En uso' : 'Inactivo'}
                    </span>
                  </div>

                  {fila && (
                    <form action={alternarActivoEgreso} className="mt-2">
                      <input type="hidden" name="id" value={String(fila.id)} />
                      <input type="hidden" name="activo" value={String(fila.activo)} />
                      <button
                        type="submit"
                        className="text-xs text-institucional underline underline-offset-2"
                      >
                        {fila.activo ? 'No usar en el análisis' : 'Usar en el análisis'}
                      </button>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </Marco>
  )
}
