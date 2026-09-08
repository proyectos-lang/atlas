'use client'

import {
  Bar, BarChart, CartesianGrid, Cell, LabelList,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { nivelDe } from '@/lib/kpi/escala'

/**
 * Barras horizontales y verticales.
 * Etiquetas de dato visibles, como en el informe original.
 * Rejilla y ejes en hairline recesivo; una sola serie, sin leyenda.
 */

export interface Barra {
  etiqueta: string
  valor: number
}

const EJE = { fontSize: 11, fill: '#6B7280' }

function Emergente({ active, payload, sufijo }: {
  active?: boolean
  payload?: { payload: Barra }[]
  sufijo: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-superficie-borde bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium text-slate-700">{d.etiqueta}</p>
      <p className="text-institucional">
        {d.valor.toFixed(1).replace('.', ',')} {sufijo}
      </p>
    </div>
  )
}

/** Recorta una etiqueta larga para que quepa en el eje. */
function recortar(t: string, max: number) {
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`
}

export function BarrasHorizontales({
  datos,
  alto = 260,
  sufijo = '%',
  porNivel = false,
  maximo = 100,
  anchoEtiqueta = 130,
}: {
  datos: Barra[]
  alto?: number
  sufijo?: string
  /** Colorea cada barra por su nivel de dominio. */
  porNivel?: boolean
  maximo?: number
  anchoEtiqueta?: number
}) {
  if (datos.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  // Una etiqueta larga se parte en varias líneas y se solapa con las vecinas.
  // Se recorta a lo que cabe; el texto completo va en el emergente.
  const maxCaracteres = Math.floor(anchoEtiqueta / 5.6)

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart
        data={datos}
        layout="vertical"
        margin={{ top: 4, right: 46, bottom: 4, left: 4 }}
      >
        <CartesianGrid horizontal={false} stroke="#EEF1F4" />
        <XAxis type="number" domain={[0, maximo]} tick={EJE} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="etiqueta"
          width={anchoEtiqueta}
          tick={EJE}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => recortar(String(v), maxCaracteres)}
        />
        <Tooltip
          cursor={{ fill: '#1F386408' }}
          content={<Emergente sufijo={sufijo} />}
        />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]} barSize={18} isAnimationActive={false}>
          {datos.map((d, i) => (
            <Cell key={i} fill={porNivel ? nivelDe(d.valor).color : '#2E86DE'} />
          ))}
          <LabelList
            dataKey="valor"
            position="right"
            formatter={(v: number) => `${v.toFixed(1).replace('.', ',')} ${sufijo}`}
            style={{ fontSize: 11, fill: '#374151' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BarrasVerticales({
  datos,
  alto = 240,
  sufijo = '%',
  maximo = 100,
}: {
  datos: Barra[]
  alto?: number
  sufijo?: string
  maximo?: number
}) {
  if (datos.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={datos} margin={{ top: 20, right: 8, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#EEF1F4" />
        <XAxis dataKey="etiqueta" tick={EJE} axisLine={false} tickLine={false} />
        <YAxis domain={[0, maximo]} tick={EJE} axisLine={false} tickLine={false} width={34} />
        <Tooltip cursor={{ fill: '#1F386408' }} content={<Emergente sufijo={sufijo} />} />
        <Bar dataKey="valor" fill="#2E86DE" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false}>
          <LabelList
            dataKey="valor"
            position="top"
            formatter={(v: number) => v.toFixed(1).replace('.', ',')}
            style={{ fontSize: 11, fill: '#374151' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Columnas apiladas por nivel de dominio (§8.4).
 * Series en el orden de la escala, con los colores de nivel y la etiqueta
 * dentro de cada segmento.
 */
export function ColumnasApiladas({
  datos,
  alto = 260,
}: {
  datos: { etiqueta: string; Básico: number; Satisfactorio: number; Alto: number; Excelente: number }[]
  alto?: number
}) {
  if (datos.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }
  const series = ['Básico', 'Satisfactorio', 'Alto', 'Excelente'] as const
  const color = { Básico: '#C0392B', Satisfactorio: '#F2C14E', Alto: '#57A773', Excelente: '#1B7F4B' }
  const textoDe = { Básico: '#FFFFFF', Satisfactorio: '#3D2F00', Alto: '#0B2E1A', Excelente: '#FFFFFF' }

  return (
    <ResponsiveContainer width="100%" height={alto}>
      {/* Margen inferior amplio: los nombres de competencia van inclinados
          para que no se solapen entre sí. */}
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 62, left: 4 }}>
        <CartesianGrid vertical={false} stroke="#EEF1F4" />
        <XAxis
          dataKey="etiqueta"
          tick={{ ...EJE, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-28}
          textAnchor="end"
          height={60}
        />
        <YAxis tick={EJE} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
        <Tooltip cursor={{ fill: '#1F386408' }} />
        {series.map((s) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="nivel"
            fill={color[s]}
            isAnimationActive={false}
            // Hueco de 2 px entre segmentos, en vez de un borde dibujado.
            stroke="#FFFFFF"
            strokeWidth={2}
          >
            <LabelList
              dataKey={s}
              position="center"
              formatter={(v: number) => (v > 0 ? v : '')}
              style={{ fontSize: 10, fill: textoDe[s], fontWeight: 500 }}
            />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
