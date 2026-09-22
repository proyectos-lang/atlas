import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { clienteServidor } from '@/lib/supabase/servidor'
import { universidades } from '@/lib/kpi/consultas'
import { FormularioPerfilEgreso, type ProgramaOpcion } from './formulario'
import { alternarActivoEgreso } from './acciones'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

export const metadata = { title: 'Perfil de egreso · ATLAS' }

interface FilaEgreso {
  id: number
  universidad_id: number
  perfil_egreso: string
  notas: string | null
  activo: boolean
  actualizado_en: string
}

export default async function PaginaPerfilEgreso() {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador'], '/admin/perfil-egreso')

  const listaUniv = await universidades(alcance)

  const db = clienteServidor()
  const { data, error } = await db
    .from('perfiles_egreso')
    .select('id, universidad_id, perfil_egreso, notas, activo, actualizado_en')

  // La tabla puede no existir todavía: la migración 06 se aplica a mano
  // desde el SQL Editor. Mejor un aviso accionable que una pantalla rota.
  const faltaTabla = faltaMigracion(error?.code)
  const filas = (data ?? []) as unknown as FilaEgreso[]
  const porUniversidad = new Map(filas.map((f) => [Number(f.universidad_id), f]))

  const programas: ProgramaOpcion[] = listaUniv.map((u) => {
    const fila = porUniversidad.get(u.id)
    return {
      id: u.id,
      etiqueta: `${u.universidad} — ${u.programa}`,
      perfilEgreso: fila?.perfil_egreso ?? '',
      notas: fila?.notas ?? '',
      activo: fila?.activo ?? true,
    }
  })

  const conPerfil = programas.filter((p) => p.perfilEgreso).length

  return (
    <Marco
      perfil={perfil}
      titulo="Perfil de egreso"
      lateral={<SubNavAdmin />}
    >
      {faltaTabla && (
        <div className="mb-5 rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            Falta aplicar la migración
          </h2>
          <p className="mt-1 text-sm text-amber-900">
            La tabla <code>atlas.perfiles_egreso</code> todavía no existe.
            Ejecuta <code>supabase/migraciones/06_perfil_egreso.sql</code> desde
            el SQL Editor de Supabase. Hasta entonces el formulario no podrá
            guardar.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Configurar perfil de egreso
          </h2>
          <p className="mb-4 mt-1 text-sm text-texto-secundario">
            El perfil de egreso declara qué debe saber hacer quien termina el
            programa. El agente de IA lo recibe como contexto al redactar cada
            recomendación, de modo que la acción propuesta apunte a lo que el
            programa promete formar y no sólo a subir un indicador.
          </p>
          <FormularioPerfilEgreso programas={programas} />
        </section>

        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Programas ({conPerfil} de {programas.length} configurados)
          </h2>
          <p className="mb-3 mt-1 text-sm text-texto-secundario">
            Un programa sin perfil de egreso no rompe nada: el agente sigue
            trabajando sólo con los indicadores.
          </p>

          <ul className="space-y-3">
            {programas.map((p) => {
              const fila = porUniversidad.get(p.id)
              return (
                <li
                  key={p.id}
                  className="rounded-md border border-superficie-borde/80 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{p.etiqueta}</div>
                      {p.perfilEgreso ? (
                        <p className="mt-1 line-clamp-3 text-xs text-texto-secundario">
                          {p.perfilEgreso}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-texto-secundario">
                          Sin perfil de egreso.
                        </p>
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
