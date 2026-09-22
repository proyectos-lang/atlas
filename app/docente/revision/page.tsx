import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { Tarjeta, BadgeNivel } from '@/componentes/graficos/base'
import { clienteServidor } from '@/lib/supabase/servidor'
import { estudiantes } from '@/lib/kpi/consultas'
import { nombreDe, mostrarAvisoSemilla } from '@/lib/kpi/catalogo'
import { aprobar, rechazar, implementar } from './acciones'

export const metadata = { title: 'Revisión de recomendaciones · ATLAS' }

const ORDEN_ESTADO = [
  'Pendiente de revisión docente', 'Aprobada', 'Implementada', 'Rechazada',
] as const

const COLOR: Record<string, string> = {
  'Pendiente de revisión docente': 'bg-slate-100 text-slate-700',
  Aprobada: 'bg-blue-100 text-blue-800',
  Rechazada: 'bg-red-100 text-red-800',
  Implementada: 'bg-green-100 text-green-800',
}

export default async function PaginaRevision() {
  const { perfil, alcance } = await exigirRol(['docente', 'admin', 'coordinador'], '/docente/revision')
  const db = clienteServidor()

  let q = db.from('recomendaciones_ia')
    .select('id, codigo, curso_id, usuario_id, tipo, competencia, nivel_actual, nivel_meta, brecha, recomendacion, justificacion, sub_indicador_critico, estado, aplicada, fecha_respuesta, fecha_aplicacion, valor_antes, valor_despues, generada_por, modelo')
    .order('estado').order('brecha', { ascending: false })
  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)

  const [{ data: recos }, listaEst] = await Promise.all([q, estudiantes(alcance)])
  const codigoEst = new Map(listaEst.map((e) => [e.id, e.codigo]))

  const filas = (recos ?? []).sort(
    (a, b) =>
      ORDEN_ESTADO.indexOf(a.estado as never) - ORDEN_ESTADO.indexOf(b.estado as never) ||
      Number(b.brecha) - Number(a.brecha)
  )

  const cuenta = (e: string) => filas.filter((r) => r.estado === e).length

  return (
    <Marco perfil={perfil} titulo="Revisión de recomendaciones">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ORDEN_ESTADO.map((e) => (
            <div key={e} className="rounded-tarjeta border border-superficie-borde border-t-[3px] border-t-institucional bg-white p-3">
              <p className="text-xs text-texto-secundario">{e}</p>
              <p className="mt-1 text-2xl font-semibold text-institucional">{cuenta(e)}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-texto-secundario">
          Las recomendaciones nunca se aplican solas. Al aprobar o rechazar se registra
          la fecha de respuesta; al implementar se guarda además el valor de la
          competencia en ese momento, que es lo que permite medir después el efecto
          de la intervención.
        </p>

        <Tarjeta titulo={`Recomendaciones (${filas.length})`}>
          {filas.length === 0 ? (
            <p className="text-xs text-texto-secundario">
              No hay recomendaciones en tu curso todavía. El Asesor Pedagógico puede
              generarlas desde su página.
            </p>
          ) : (
            <ul className="space-y-3">
              {filas.map((r) => {
                const destinatario = r.usuario_id === null
                  ? 'Todo el curso'
                  : (codigoEst.get(Number(r.usuario_id)) ?? '—')
                const simulado = mostrarAvisoSemilla(String(r.sub_indicador_critico ?? ''))
                const pendiente = r.estado === 'Pendiente de revisión docente'
                const aprobada = r.estado === 'Aprobada'

                return (
                  <li key={String(r.id)} className="rounded-md border border-superficie-borde p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                          <span>{destinatario}</span>
                          {r.tipo === 'Grupal' && (
                            <span className="rounded bg-institucional/10 px-1.5 text-[10px] text-institucional">
                              Grupal
                            </span>
                          )}
                          <span className="text-texto-secundario">·</span>
                          <span>{r.competencia}</span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-texto-secundario">
                          <BadgeNivel valor={r.nivel_actual === 'Básico' ? 30 : r.nivel_actual === 'Satisfactorio' ? 67 : r.nivel_actual === 'Alto' ? 82 : 95} />
                          <span>→ {r.nivel_meta}</span>
                          <span>· brecha {Number(r.brecha).toFixed(1).replace('.', ',')} puntos</span>
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${COLOR[String(r.estado)] ?? 'bg-slate-100'}`}>
                        {r.estado}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-800">{r.recomendacion}</p>

                    {r.justificacion && (
                      <p className="mt-1 text-xs text-texto-secundario">
                        <span className="font-medium">Por qué:</span> {r.justificacion}
                      </p>
                    )}

                    <p className="mt-1 text-[11px] text-texto-secundario">
                      {r.sub_indicador_critico && (
                        <>Indicador crítico: {nombreDe(String(r.sub_indicador_critico))}
                        {simulado && (
                          <span className="ml-1 text-amber-700">· pendiente de evaluación docente</span>
                        )}
                        {' · '}</>
                      )}
                      {r.generada_por === 'agente-ia'
                        ? `generada por el asistente (${r.modelo})`
                        : 'cargada del origen'}
                      {r.valor_antes !== null && (
                        <> · valor antes: {Number(r.valor_antes).toFixed(1).replace('.', ',')} %</>
                      )}
                      {r.valor_despues !== null && (
                        <> · después: {Number(r.valor_despues).toFixed(1).replace('.', ',')} %</>
                      )}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {pendiente && (
                        <>
                          <form action={aprobar}>
                            <input type="hidden" name="id" value={String(r.id)} />
                            <button className="rounded-md bg-institucional px-3 py-1.5 text-xs font-medium text-white transition hover:bg-institucional-claro">
                              Aprobar
                            </button>
                          </form>
                          <form action={rechazar}>
                            <input type="hidden" name="id" value={String(r.id)} />
                            <button className="rounded-md border border-superficie-borde px-3 py-1.5 text-xs transition hover:bg-slate-50">
                              Rechazar
                            </button>
                          </form>
                        </>
                      )}
                      {(pendiente || aprobada) && (
                        <form action={implementar}>
                          <input type="hidden" name="id" value={String(r.id)} />
                          <button className="rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs text-green-800 transition hover:bg-green-100">
                            Marcar como implementada
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>
      </div>
    </Marco>
  )
}
