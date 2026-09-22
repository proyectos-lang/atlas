import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { Tarjeta } from '@/componentes/graficos/base'
import { clienteServidor } from '@/lib/supabase/servidor'
import { cursos, estudiantes, universidades } from '@/lib/kpi/consultas'
import { indicesPorEstudiante } from '@/lib/kpi/indicadores'
import { INDICE_DE_COMPETENCIA, nombreDe, mostrarAvisoSemilla } from '@/lib/kpi/catalogo'
import { PanelRecomendador } from '@/componentes/panel-recomendador'

export const metadata = { title: 'Recomendaciones de IA · ATLAS' }

const UMBRAL_ALTO = 75

const COLOR_ESTADO: Record<string, string> = {
  'Pendiente de revisión docente': 'bg-slate-100 text-slate-700',
  Aprobada: 'bg-blue-100 text-blue-800',
  Rechazada: 'bg-red-100 text-red-800',
  Implementada: 'bg-green-100 text-green-800',
}

export default async function PaginaRecomendador() {
  const { perfil, alcance } = await exigirRol(['asesor', 'admin', 'coordinador'], '/recomendador')

  const [listaUniv, listaCursos, listaEst, porEst] = await Promise.all([
    universidades(alcance),
    cursos(alcance),
    estudiantes(alcance),
    indicesPorEstudiante(alcance),
  ])

  const codigoCurso = new Map(listaCursos.map((c) => [c.id, c.codigo]))
  const nombreCurso = new Map(listaCursos.map((c) => [c.id, c.nombre]))
  const codigoUniv = new Map(listaUniv.map((u) => [u.id, u.codigo]))
  const indicesDe = new Map(porEst.map((e) => [e.usuarioId, e]))

  // Cuántas competencias tiene cada estudiante por debajo del nivel Alto.
  const opcionesEstudiante = listaEst.map((e) => {
    const i = indicesDe.get(e.id)
    const bajo = i
      ? Object.values(INDICE_DE_COMPETENCIA).filter(
          (cod) => (i[cod.toLowerCase() as 'ite'] ?? 0) < UMBRAL_ALTO
        ).length
      : 0
    return {
      codigo: e.codigo,
      cursoCodigo: e.cursoId === null ? '' : (codigoCurso.get(e.cursoId) ?? ''),
      ctg: i?.ctg ?? 0,
      competenciasBajoAlto: bajo,
    }
  })

  // Últimas recomendaciones generadas por el agente, para ver el resultado.
  const db = clienteServidor()
  let q = db.from('recomendaciones_ia')
    .select('id, codigo, curso_id, usuario_id, tipo, competencia, brecha, recomendacion, justificacion, sub_indicador_critico, estado, modelo, tokens_usados, fecha_emision')
    .eq('generada_por', 'agente-ia')
    .order('fecha_emision', { ascending: false })
    .limit(12)
  if (alcance.cursoIds !== null) q = q.in('curso_id', alcance.cursoIds)
  const { data: recientes } = await q

  const codigoEst = new Map(listaEst.map((e) => [e.id, e.codigo]))

  return (
    <Marco perfil={perfil} titulo="Recomendaciones de IA">
      <div className="space-y-5">
        <Tarjeta
          titulo="Asistente Didáctico"
          subtitulo="Elige el ámbito y genera recomendaciones pedagógicas a partir de los indicadores"
        >
          <PanelRecomendador
            universidades={listaUniv.map((u) => ({
              codigo: u.codigo, nombre: u.universidad, programa: u.programa,
            }))}
            cursos={listaCursos.map((c) => ({
              codigo: c.codigo,
              nombre: c.nombre,
              universidadCodigo: codigoUniv.get(c.universidadId) ?? '',
            }))}
            estudiantes={opcionesEstudiante}
          />
        </Tarjeta>

        <Tarjeta
          titulo="Últimas recomendaciones generadas"
          subtitulo="Se guardan pendientes de revisión; el docente las aprueba, rechaza o implementa desde su panel"
        >
          {(recientes ?? []).length === 0 ? (
            <p className="text-xs text-texto-secundario">
              El asistente todavía no ha generado recomendaciones en tu ámbito.
            </p>
          ) : (
            <ul className="space-y-2">
              {(recientes ?? []).map((r) => {
                const destinatario = r.usuario_id === null
                  ? 'Todo el curso'
                  : (codigoEst.get(Number(r.usuario_id)) ?? '—')
                const simulado = mostrarAvisoSemilla(String(r.sub_indicador_critico ?? ''))
                return (
                  <li key={String(r.id)} className="rounded-md border border-superficie-borde p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-slate-700">{destinatario}</span>
                      {r.tipo === 'Grupal' && (
                        <span className="rounded bg-institucional/10 px-1.5 text-[10px] text-institucional">
                          Grupal
                        </span>
                      )}
                      <span className="text-texto-secundario">·</span>
                      <span>{r.competencia}</span>
                      <span className="text-texto-secundario">
                        · {nombreCurso.get(Number(r.curso_id)) ?? ''}
                      </span>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${
                        COLOR_ESTADO[String(r.estado)] ?? 'bg-slate-100'}`}>
                        {r.estado}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-800">{r.recomendacion}</p>
                    {r.justificacion && (
                      <p className="mt-1 text-xs text-texto-secundario">
                        <span className="font-medium">Por qué:</span> {r.justificacion}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-texto-secundario">
                      Brecha {Number(r.brecha).toFixed(1).replace('.', ',')} puntos
                      {r.sub_indicador_critico && (
                        <> · indicador crítico: {nombreDe(String(r.sub_indicador_critico))}
                          {simulado && (
                            <span className="ml-1 text-amber-700">· pendiente de evaluación docente</span>
                          )}
                        </>
                      )}
                      {' · '}{r.modelo} · {r.tokens_usados ?? 0} tokens
                    </p>
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
