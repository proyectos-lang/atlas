import { exigirSesion } from '@/lib/auth/sesion'
import { Pagina, SinResultados } from '@/componentes/pagina'
import { resolverFiltros, seleccionDe, alcanceVacio } from '@/lib/kpi/filtros'
import { estudiantes as estudiantesDe } from '@/lib/kpi/consultas'
import {
  descriptiva, diagnostica, predictiva, dificultadesGrupales,
  type NivelRiesgo, type TipoDiagnostico,
} from '@/lib/analitica/modelo'
import { nivelDe } from '@/lib/kpi/escala'

export const metadata = { title: 'Analítica · ATLAS' }

/**
 * Analítica descriptiva, diagnóstica y predictiva.
 *
 * Todo se lee sobre indicadores, no sobre calificaciones: la pantalla
 * responde «falla en depuración», no «tiene 60». La prescriptiva vive en
 * el recomendador de IA.
 */

const COLOR_RIESGO: Record<NivelRiesgo, string> = {
  Alto: 'bg-red-100 text-red-900',
  Medio: 'bg-amber-100 text-amber-900',
  Bajo: 'bg-green-100 text-green-900',
}

const COLOR_TIPO: Record<TipoDiagnostico, string> = {
  'Dificultad individual': 'bg-red-100 text-red-900',
  'Dificultad del grupo': 'bg-amber-100 text-amber-900',
  'En desarrollo': 'bg-slate-100 text-slate-700',
  Logrado: 'bg-green-100 text-green-900',
  'Fortaleza destacada': 'bg-emerald-100 text-emerald-900',
}

const pct = (v: number) => `${v.toFixed(1).replace('.', ',')} %`

export default async function PaginaAnalitica({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { perfil, alcance } = await exigirSesion('/analitica')
  const f = await resolverFiltros(alcance, seleccionDe(await searchParams))

  if (alcanceVacio(f.alcance)) {
    return (
      <Pagina perfil={perfil} titulo="Analítica" controles={f.controles}>
        <SinResultados />
      </Pagina>
    )
  }

  const [desc, diag, pred, grupales, listaEst] = await Promise.all([
    descriptiva(f.alcance, f.semanas),
    diagnostica(f.alcance, f.semanas),
    predictiva(f.alcance, f.semanas),
    dificultadesGrupales(f.alcance, f.semanas),
    estudiantesDe(f.alcance),
  ])

  const codigoEst = new Map(listaEst.map((e) => [e.id, e.codigo]))
  const sinDatos = desc.length === 0

  // Descriptiva: media por dimensión en el ámbito.
  const porDimension = new Map<number, { nombre: string; competencia: string; valores: number[]; evidencias: number }>()
  for (const d of desc) {
    const previo = porDimension.get(d.dimensionId)
    porDimension.set(d.dimensionId, {
      nombre: d.dimension,
      competencia: d.competencia,
      valores: [...(previo?.valores ?? []), d.valor],
      evidencias: (previo?.evidencias ?? 0) + d.evidencias,
    })
  }

  const dimensiones = [...porDimension.entries()]
    .map(([id, v]) => ({
      id,
      nombre: v.nombre,
      competencia: v.competencia,
      media: v.valores.reduce((t, x) => t + x, 0) / v.valores.length,
      medidos: v.valores.length,
      evidencias: v.evidencias,
    }))
    .sort((a, b) => a.media - b.media)

  // Diagnóstica: lo más severo primero.
  const dificultades = diag
    .filter((d) => d.tipo === 'Dificultad individual' || d.tipo === 'Dificultad del grupo')
    .sort((a, b) => a.valor - b.valor)
    .slice(0, 20)

  const fortalezas = diag
    .filter((d) => d.tipo === 'Fortaleza destacada')
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  // Predictiva: quién requiere atención.
  const enRiesgo = pred
    .filter((p) => p.riesgo !== 'Bajo')
    .sort((a, b) => a.mediaGeneral - b.mediaGeneral)

  return (
    <Pagina perfil={perfil} titulo="Analítica" controles={f.controles}>
      <div className="space-y-5 pb-8">
        {sinDatos && (
          <div className="rounded-tarjeta border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Todavía no hay evidencias registradas
            </h2>
            <p className="mt-1 text-sm text-amber-900">
              La analítica se calcula sobre las evidencias de los indicadores.
              Cárgalas desde <strong>Administración → Fuentes de datos</strong>,
              o comprueba que las migraciones 11 a 14 estén aplicadas.
            </p>
          </div>
        )}

        {/* ---------- Predictiva ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Estudiantes que requieren atención
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-texto-secundario">
            No es una predicción de nota: son patrones observables asociados
            con bajo logro. Cada alerta dice por qué se marcó, para que puedas
            contrastarla con lo que ves en clase. La cobertura indica sobre
            cuántas dimensiones medidas se sostiene el diagnóstico.
          </p>

          {enRiesgo.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              {sinDatos
                ? 'Sin evidencias no hay patrones que detectar.'
                : 'Ningún estudiante presenta señales de riesgo en este ámbito.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                    <th className="py-2 pr-3 font-medium">Estudiante</th>
                    <th className="py-2 pr-3 font-medium">Riesgo</th>
                    <th className="py-2 pr-3 font-medium">Media</th>
                    <th className="py-2 pr-3 font-medium">Dimensiones bajas</th>
                    <th className="py-2 pr-3 font-medium">Cobertura</th>
                    <th className="py-2 font-medium">Por qué</th>
                  </tr>
                </thead>
                <tbody>
                  {enRiesgo.map((p) => (
                    <tr key={p.usuarioId} className="border-b border-superficie-borde/60 align-top">
                      <td className="py-2 pr-3 font-medium">
                        {codigoEst.get(p.usuarioId) ?? p.usuarioId}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR_RIESGO[p.riesgo]}`}>
                          {p.riesgo}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{pct(p.mediaGeneral)}</td>
                      <td className="py-2 pr-3 text-texto-secundario">
                        {p.dimensionesBajas} de {p.dimensionesTotales}
                      </td>
                      <td className="py-2 pr-3 text-texto-secundario">
                        {p.cobertura === null
                          ? '—'
                          : `${Math.round(p.cobertura * 100)} %`}
                      </td>
                      <td className="py-2">
                        <ul className="space-y-0.5 text-xs text-texto-secundario">
                          {p.senales.map((s, i) => (
                            <li key={i}>· {s}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------- Diagnóstica grupal ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Dificultades del grupo
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-texto-secundario">
            Dimensiones en las que más del 40 % del curso está por debajo de 60.
            Cuando falla casi todo el grupo, la intervención es para la clase,
            no para una persona.
          </p>

          {grupales.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              {sinDatos
                ? 'Sin evidencias no hay diagnóstico.'
                : 'Ninguna dimensión falla de forma generalizada.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {grupales.map((g) => (
                <li
                  key={`${g.cursoId}-${g.dimensionId}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-amber-900">
                      {g.dimension}
                      <span className="ml-2 font-normal">· {g.competencia}</span>
                    </span>
                    <span className="text-sm text-amber-900">
                      {g.afectados} de {g.total} estudiantes ·{' '}
                      media {pct(g.media)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Descriptiva ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <h2 className="text-lg font-semibold text-institucional">
            Estado por dimensión
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-texto-secundario">
            De menor a mayor logro. El número de evidencias importa tanto como
            el valor: una dimensión medida con pocos datos no sostiene una
            decisión.
          </p>

          {dimensiones.length === 0 ? (
            <p className="text-sm text-texto-secundario">Sin datos en este ámbito.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-sm">
                <thead>
                  <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                    <th className="py-2 pr-3 font-medium">Dimensión</th>
                    <th className="py-2 pr-3 font-medium">Competencia</th>
                    <th className="py-2 pr-3 font-medium">Media</th>
                    <th className="py-2 pr-3 font-medium">Nivel</th>
                    <th className="py-2 font-medium">Evidencias</th>
                  </tr>
                </thead>
                <tbody>
                  {dimensiones.map((d) => {
                    const n = nivelDe(d.media)
                    return (
                      <tr key={d.id} className="border-b border-superficie-borde/60">
                        <td className="py-2 pr-3 font-medium">{d.nombre}</td>
                        <td className="py-2 pr-3 text-texto-secundario">{d.competencia}</td>
                        <td className="py-2 pr-3">{pct(d.media)}</td>
                        <td className="py-2 pr-3">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: n.color, color: n.colorTexto }}
                          >
                            {n.nivel}
                          </span>
                        </td>
                        <td className="py-2 text-texto-secundario">
                          {d.evidencias} en {d.medidos} estudiante(s)
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---------- Diagnóstica individual ---------- */}
        {dificultades.length > 0 && (
          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-lg font-semibold text-institucional">
              Dificultades por estudiante
            </h2>
            <p className="mb-4 mt-1 max-w-3xl text-sm text-texto-secundario">
              «Dificultad individual» significa que está por debajo de sus
              compañeros; «del grupo», que el curso entero flojea ahí.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                    <th className="py-2 pr-3 font-medium">Estudiante</th>
                    <th className="py-2 pr-3 font-medium">Dimensión</th>
                    <th className="py-2 pr-3 font-medium">Valor</th>
                    <th className="py-2 pr-3 font-medium">Grupo</th>
                    <th className="py-2 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {dificultades.map((d) => (
                    <tr
                      key={`${d.usuarioId}-${d.dimensionId}`}
                      className="border-b border-superficie-borde/60"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {codigoEst.get(d.usuarioId) ?? d.usuarioId}
                      </td>
                      <td className="py-2 pr-3">
                        {d.dimension}
                        <span className="ml-1.5 text-xs text-texto-secundario">
                          {d.competencia}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{pct(d.valor)}</td>
                      <td className="py-2 pr-3 text-texto-secundario">
                        {pct(d.mediaGrupo)}
                      </td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR_TIPO[d.tipo]}`}>
                          {d.tipo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ---------- Fortalezas ---------- */}
        {fortalezas.length > 0 && (
          <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
            <h2 className="text-lg font-semibold text-institucional">Fortalezas</h2>
            <p className="mb-3 mt-1 text-sm text-texto-secundario">
              Dimensiones en nivel Excelente. Sirven para apoyarse en ellas al
              diseñar la intervención.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {fortalezas.map((d) => (
                <li
                  key={`${d.usuarioId}-${d.dimensionId}`}
                  className="rounded-lg border border-superficie-borde p-3 text-sm"
                >
                  <span className="font-medium">
                    {codigoEst.get(d.usuarioId) ?? d.usuarioId}
                  </span>
                  <span className="ml-2 text-texto-secundario">
                    {d.dimension} · {pct(d.valor)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Pagina>
  )
}
