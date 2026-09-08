import { nivelDe } from '@/lib/kpi/escala'

/**
 * Matriz con formato condicional por la escala de dominio (§8.5).
 * Rojo bajo 60, amarillo 60-74, verde claro 75-89, verde 90-100.
 *
 * La identidad no descansa solo en el color: cada celda muestra su valor,
 * y el encabezado indica que el color sigue la escala de niveles.
 */

export interface FilaMatriz {
  etiqueta: string
  valores: (number | null)[]
}

export function Matriz({
  columnas,
  filas,
  conFormato = true,
  conTotal = true,
  etiquetaFila = '',
  decimales = 1,
}: {
  columnas: string[]
  filas: FilaMatriz[]
  /** true = escala de dominio; false = fondo dorado plano, como el informe. */
  conFormato?: boolean
  conTotal?: boolean
  etiquetaFila?: string
  decimales?: number
}) {
  if (filas.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  // Total: promedio por columna de los valores presentes.
  const total = columnas.map((_, c) => {
    const v = filas.map((f) => f.valores[c]).filter((x): x is number => x !== null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  })

  const celda = (v: number | null) => {
    if (v === null || !Number.isFinite(v)) {
      return { fondo: '#FFFFFF', texto: '#6B7280', contenido: '—' }
    }
    const n = nivelDe(v)
    return {
      fondo: conFormato ? n.color : '#E8D44D',
      texto: conFormato ? n.colorTexto : '#3D2F00',
      contenido: v.toFixed(decimales).replace('.', ','),
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white p-2 text-left font-medium text-texto-secundario">
              {etiquetaFila}
            </th>
            {columnas.map((c) => (
              <th key={c} className="p-2 text-center font-medium text-institucional">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.etiqueta}>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white p-2 text-left font-normal text-slate-700"
              >
                {f.etiqueta}
              </th>
              {f.valores.map((v, i) => {
                const { fondo, texto, contenido } = celda(v)
                return (
                  <td
                    key={i}
                    // El hueco de 2 px separa las celdas sin dibujar bordes.
                    className="p-[1px]"
                  >
                    <div
                      className="rounded-[3px] px-2 py-1.5 text-center tabular-nums"
                      style={{ backgroundColor: fondo, color: texto }}
                    >
                      {contenido}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}

          {conTotal && (
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white p-2 text-left font-semibold text-institucional"
              >
                Total
              </th>
              {total.map((v, i) => {
                const { fondo, texto, contenido } = celda(v)
                return (
                  <td key={i} className="p-[1px]">
                    <div
                      className="rounded-[3px] px-2 py-1.5 text-center font-semibold tabular-nums"
                      style={{ backgroundColor: fondo, color: texto }}
                    >
                      {contenido}
                    </div>
                  </td>
                )
              })}
            </tr>
          )}
        </tbody>
      </table>

      {conFormato && (
        <p className="mt-2 text-[11px] text-texto-secundario">
          El color sigue la escala de dominio: Básico bajo 60, Satisfactorio 60 a 74,
          Alto 75 a 89, Excelente 90 o más.
        </p>
      )}
    </div>
  )
}
