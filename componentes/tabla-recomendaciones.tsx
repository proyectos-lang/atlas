'use client'

import { useMemo, useState } from 'react'
import { BadgeNivel } from './graficos/base'
import type { Recomendacion } from '@/lib/kpi/indicadores'

/**
 * Tabla de recomendaciones (§8.4).
 * Ordenable y paginada, con fila de total de brecha.
 */

type Columna = 'estudiante' | 'competencia' | 'nivelActual' | 'nivelMeta' | 'brecha' | 'estado'

const POR_PAGINA = 12

const ESTADO_COLOR: Record<string, string> = {
  'Pendiente de revisión docente': 'bg-slate-100 text-slate-700',
  Aprobada: 'bg-blue-100 text-blue-800',
  Rechazada: 'bg-red-100 text-red-800',
  Implementada: 'bg-green-100 text-green-800',
}

export function TablaRecomendaciones({
  filas,
  nombreEstudiante,
}: {
  filas: Recomendacion[]
  nombreEstudiante: Record<number, string>
}) {
  const [orden, setOrden] = useState<Columna>('brecha')
  const [desc, setDesc] = useState(true)
  const [pagina, setPagina] = useState(0)

  const etiquetaDe = (r: Recomendacion) =>
    r.usuarioId === null ? 'Todo el curso' : (nombreEstudiante[r.usuarioId] ?? '—')

  const ordenadas = useMemo(() => {
    const copia = [...filas]
    copia.sort((a, b) => {
      let d = 0
      if (orden === 'brecha') d = a.brecha - b.brecha
      else if (orden === 'estudiante') d = etiquetaDe(a).localeCompare(etiquetaDe(b))
      else d = String(a[orden]).localeCompare(String(b[orden]))
      return desc ? -d : d
    })
    return copia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, orden, desc, nombreEstudiante])

  const paginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA))
  const actual = Math.min(pagina, paginas - 1)
  const visibles = ordenadas.slice(actual * POR_PAGINA, (actual + 1) * POR_PAGINA)

  // El total de brecha es de TODAS las filas, no sólo de la página visible.
  const totalBrecha = filas.reduce((t, r) => t + r.brecha, 0)

  function ordenarPor(c: Columna) {
    if (c === orden) setDesc(!desc)
    else { setOrden(c); setDesc(c === 'brecha') }
    setPagina(0)
  }

  const Encabezado = ({ col, children, alinear = 'left' }: {
    col: Columna; children: React.ReactNode; alinear?: 'left' | 'right'
  }) => (
    <th className={`p-2 font-medium ${alinear === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => ordenarPor(col)}
        className="inline-flex items-center gap-1 text-institucional hover:underline"
      >
        {children}
        <span aria-hidden className="text-[9px] text-texto-secundario">
          {orden === col ? (desc ? '▼' : '▲') : '↕'}
        </span>
      </button>
    </th>
  )

  if (filas.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-superficie-borde">
              <Encabezado col="estudiante">Estudiante</Encabezado>
              <Encabezado col="competencia">Competencia</Encabezado>
              <Encabezado col="nivelActual">Nivel actual</Encabezado>
              <Encabezado col="nivelMeta">Nivel meta</Encabezado>
              <Encabezado col="brecha" alinear="right">Brecha</Encabezado>
              <th className="p-2 text-left font-medium text-institucional">Recomendación</th>
              <Encabezado col="estado">Estado</Encabezado>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.id} className="border-b border-superficie-borde/60 align-top">
                <td className="p-2 whitespace-nowrap">
                  {etiquetaDe(r)}
                  {r.tipo === 'Grupal' && (
                    <span className="ml-1 rounded bg-institucional/10 px-1 text-[10px] text-institucional">
                      Grupal
                    </span>
                  )}
                </td>
                <td className="p-2">{r.competencia}</td>
                <td className="p-2"><NivelTexto nivel={r.nivelActual} /></td>
                <td className="p-2"><NivelTexto nivel={r.nivelMeta} /></td>
                <td className="p-2 text-right tabular-nums">
                  {r.brecha.toFixed(1).replace('.', ',')}
                </td>
                <td className="p-2 text-slate-700">{r.recomendacion}</td>
                <td className="p-2">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ${
                    ESTADO_COLOR[r.estado] ?? 'bg-slate-100 text-slate-700'}`}>
                    {r.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-superficie-borde">
              <td className="p-2 font-semibold text-institucional" colSpan={4}>
                Total de brecha ({filas.length} recomendaciones)
              </td>
              <td className="p-2 text-right font-semibold tabular-nums text-institucional">
                {totalBrecha.toFixed(1).replace('.', ',')}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {paginas > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-texto-secundario">
            Página {actual + 1} de {paginas}
          </span>
          <div className="flex gap-2">
            <button
              type="button" disabled={actual === 0}
              onClick={() => setPagina(actual - 1)}
              className="rounded-md border border-superficie-borde px-2.5 py-1
                         transition hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button" disabled={actual >= paginas - 1}
              onClick={() => setPagina(actual + 1)}
              className="rounded-md border border-superficie-borde px-2.5 py-1
                         transition hover:bg-slate-50 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Nivel escrito, con su color de la escala. */
function NivelTexto({ nivel }: { nivel: string }) {
  const valor: Record<string, number> = {
    'Básico': 30, Satisfactorio: 67, Alto: 82, Excelente: 95,
  }
  const v = valor[nivel]
  if (v === undefined) return <span className="text-texto-secundario">{nivel}</span>
  return <BadgeNivel valor={v} />
}
