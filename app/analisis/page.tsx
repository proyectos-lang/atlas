import { exigirSesion } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { Tarjeta, AvisoSemilla } from '@/componentes/graficos/base'
import {
  CATALOGO, AVISO_SEMILLA, MOSTRAR_AVISOS_SEMILLA, type Indicador,
} from '@/lib/kpi/catalogo'

export const metadata = { title: 'Análisis · ATLAS' }

/**
 * Catálogo de los 36 indicadores.
 *
 * Es la pantalla que hace verificable el resto del sistema: de dónde sale
 * cada número, cómo se calcula, si admite seguimiento semanal y si se apoya
 * en criterios de rúbrica pendientes de evaluación docente.
 */

const COLOR_ESTADO: Record<string, string> = {
  Directo: 'bg-green-100 text-green-800',
  Parámetro: 'bg-blue-100 text-blue-800',
  Derivado: 'bg-slate-100 text-slate-700',
  Semilla: 'bg-amber-100 text-amber-900',
  'Sin fuente': 'bg-red-100 text-red-800',
}

const COLOR_SEGUIMIENTO: Record<string, string> = {
  'Sí': 'bg-green-100 text-green-800',
  Parcial: 'bg-amber-100 text-amber-900',
  No: 'bg-slate-100 text-slate-600',
}

export default async function PaginaAnalisis() {
  const { perfil } = await exigirSesion('/analisis')

  const porCompetencia = new Map<string, Indicador[]>()
  for (const i of CATALOGO) {
    porCompetencia.set(i.competencia, [...(porCompetencia.get(i.competencia) ?? []), i])
  }

  const sinFuente = CATALOGO.filter((i) => i.estadoDato === 'Sin fuente').length
  const conSemana = CATALOGO.filter((i) => i.seguimientoSemanal !== 'No').length

  return (
    <Marco perfil={perfil} titulo="Análisis">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Resumen titulo="Indicadores definidos" valor={CATALOGO.length} pie="en el catálogo" />
          <Resumen titulo="Admiten seguimiento semanal" valor={conSemana} pie="total o parcial" />
          <Resumen titulo="Todavía sin fuente" valor={sinFuente} pie="requieren seguimiento" acento="red" />
        </div>

        <div className="rounded-tarjeta border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-900">
            <strong className="font-semibold">Cómo leer esta tabla.</strong>{' '}
            <em>Directo</em> significa que el valor sale de los registros de Moodle.{' '}
            <em>Parámetro</em>, que además usa un valor esperado configurable por el docente.{' '}
            <em>Derivado</em>, que promedia otros indicadores.{' '}
            <em>Semilla</em>, que procede de la rúbrica del docente.{' '}
            <em>Sin fuente</em>, que el dato necesario todavía no se registra.
          </p>
        </div>

        {[...porCompetencia.entries()].map(([competencia, indicadores]) => (
          <Tarjeta key={competencia} titulo={competencia}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                    <th className="p-2 font-medium">Indicador</th>
                    <th className="p-2 font-medium">Cómo se calcula</th>
                    <th className="p-2 font-medium">De dónde sale</th>
                    <th className="p-2 font-medium">Escala</th>
                    <th className="p-2 font-medium">Estado del dato</th>
                    <th className="p-2 font-medium">Seguimiento semanal</th>
                  </tr>
                </thead>
                <tbody>
                  {indicadores.map((i) => (
                    <tr key={i.codigo} className="border-b border-superficie-borde/60 align-top">
                      <td className="p-2">
                        <span className="flex items-center gap-1.5 font-medium text-slate-700">
                          {i.nombre}
                          {MOSTRAR_AVISOS_SEMILLA && i.estadoDato === 'Semilla' && <AvisoSemilla />}
                        </span>
                        <span className="text-[10px] text-texto-secundario">{i.nivel}</span>
                      </td>
                      <td className="p-2 text-slate-600">{i.formulaCorta}</td>
                      <td className="p-2 text-texto-secundario">{i.fuente}</td>
                      <td className="p-2 text-texto-secundario">
                        {i.escala}
                        {i.truncar100 && i.escala === 'Porcentaje' && (
                          <span className="block text-[10px]">se limita a 100</span>
                        )}
                      </td>
                      <td className="p-2">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ${
                          COLOR_ESTADO[i.estadoDato] ?? 'bg-slate-100'}`}>
                          {i.estadoDato}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                          COLOR_SEGUIMIENTO[i.seguimientoSemanal] ?? 'bg-slate-100'}`}>
                          {i.seguimientoSemanal}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        ))}

        {MOSTRAR_AVISOS_SEMILLA && (
          <p className="pb-4 text-[11px] text-texto-secundario">{AVISO_SEMILLA}</p>
        )}
      </div>
    </Marco>
  )
}

function Resumen({
  titulo, valor, pie, acento,
}: {
  titulo: string; valor: number; pie: string; acento?: 'amber' | 'red'
}) {
  const color =
    acento === 'amber' ? 'text-amber-700'
    : acento === 'red' ? 'text-red-700'
    : 'text-institucional'
  return (
    <div className="rounded-tarjeta border border-superficie-borde border-t-[3px] border-t-institucional bg-white p-3">
      <p className="text-xs text-texto-secundario">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{valor}</p>
      <p className="mt-1 text-[11px] text-texto-secundario">{pie}</p>
    </div>
  )
}
