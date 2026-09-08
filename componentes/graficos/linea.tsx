'use client'

import {
  CartesianGrid, Legend, Line, LineChart, LabelList,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

/**
 * Evolución temporal por semana.
 *
 * Sólo debe recibir indicadores con seguimiento semanal ('Sí' o 'Parcial').
 * Los que no lo admiten van a un panel aparte: una línea recta dentro de un
 * gráfico titulado "evolución" afirmaría un cambio que no se midió.
 *
 * Paleta categórica validada con scripts/validate_palette.js:
 * todas las parejas pasan separación CVD, piso de croma y contraste.
 */
export const SERIES = [
  '#2E86DE', // azul institucional de gráficos
  '#D95F02', // naranja
  '#0E9E7E', // verde azulado
  '#7B4EA8', // morado
  '#C2185B', // magenta
] as const

const EJE = { fontSize: 11, fill: '#6B7280' }

export interface SerieLinea {
  clave: string
  nombre: string
}

export function Linea({
  datos,
  series,
  alto = 260,
  etiquetasDeDato = true,
  dominio = [0, 100] as [number, number],
}: {
  /** Una fila por semana: { semana, [clave]: valor } */
  datos: Record<string, number | string | null>[]
  series: SerieLinea[]
  alto?: number
  etiquetasDeDato?: boolean
  dominio?: [number, number]
}) {
  if (datos.length === 0 || series.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  // Una etiqueta en cada punto se solapa entre series y con el eje.
  // Se etiqueta sólo el extremo derecho de cada línea; el resto lo llevan
  // el eje y el emergente al pasar el cursor.
  const ultima = datos.length - 1
  const conEtiquetas = etiquetasDeDato && series.length <= 5

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <LineChart data={datos} margin={{ top: 18, right: 34, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#EEF1F4" />
        <XAxis
          dataKey="semana"
          tick={EJE}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `Semana ${v}`}
        />
        <YAxis domain={dominio} tick={EJE} axisLine={false} tickLine={false} width={34} />
        <Tooltip
          contentStyle={{
            fontSize: 12, borderRadius: 6,
            border: '1px solid #E1E5EA', boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          }}
          labelFormatter={(v) => `Semana ${v}`}
          formatter={(v: number, n: string) => [
            v === null ? '—' : `${Number(v).toFixed(1).replace('.', ',')} %`, n,
          ]}
        />
        {series.length > 1 && (
          <Legend
            verticalAlign="middle"
            align="right"
            layout="vertical"
            wrapperStyle={{ fontSize: 11, paddingLeft: 26 }}
          />
        )}
        {series.map((s, i) => (
          <Line
            key={s.clave}
            type="monotone"
            dataKey={s.clave}
            name={s.nombre}
            stroke={SERIES[i % SERIES.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: '#FFFFFF', strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          >
            {conEtiquetas && (
              <LabelList
                dataKey={s.clave}
                position="right"
                offset={8}
                // Sólo el último punto: etiquetar todos los solapa entre sí.
                content={(props) => {
                  const { index, x, y, value } = props as {
                    index?: number
                    x?: number | string
                    y?: number | string
                    value?: number | string
                  }
                  if (index !== ultima || value === null || value === undefined) return null
                  return (
                    <text
                      x={Number(x) + 8}
                      y={Number(y)}
                      dominantBaseline="central"
                      style={{ fontSize: 11, fill: SERIES[i % SERIES.length], fontWeight: 500 }}
                    >
                      {Number(value).toFixed(0)}
                    </text>
                  )
                }}
              />
            )}
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
