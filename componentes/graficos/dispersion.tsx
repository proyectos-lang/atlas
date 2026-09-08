'use client'

import {
  CartesianGrid, ReferenceArea, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'

/**
 * Dispersión de riesgo (§8.5).
 * Eje X índice de aprendizaje autónomo, eje Y desempeño en problemas aplicados,
 * un punto por estudiante. El cuadrante inferior izquierdo identifica a los
 * estudiantes en riesgo y se marca con un sombreado suave.
 *
 * El corte en 75 es el umbral del nivel Alto de la escala de dominio, el mismo
 * que usa la etapa 5 del embudo.
 */

export interface PuntoEstudiante {
  estudiante: string
  x: number
  y: number
}

const CORTE = 75

function Emergente({ active, payload, ejeX, ejeY }: {
  active?: boolean
  payload?: { payload: PuntoEstudiante }[]
  ejeX: string
  ejeY: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const enRiesgo = d.x < CORTE && d.y < CORTE
  return (
    <div className="rounded-md border border-superficie-borde bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <p className="font-medium text-slate-700">{d.estudiante}</p>
      <p className="text-texto-secundario">
        {ejeX}: <span className="text-institucional">{d.x.toFixed(1).replace('.', ',')} %</span>
      </p>
      <p className="text-texto-secundario">
        {ejeY}: <span className="text-institucional">{d.y.toFixed(1).replace('.', ',')} %</span>
      </p>
      {enRiesgo && (
        <p className="mt-1 font-medium text-[#C0392B]">En riesgo en ambos indicadores</p>
      )}
    </div>
  )
}

export function Dispersion({
  datos,
  ejeX = 'Índice de Aprendizaje Autónomo',
  ejeY = 'Desempeño en Problemas Aplicados',
  alto = 300,
}: {
  datos: PuntoEstudiante[]
  ejeX?: string
  ejeY?: string
  alto?: number
}) {
  if (datos.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  const enRiesgo = datos.filter((d) => d.x < CORTE && d.y < CORTE)

  return (
    <div>
      <ResponsiveContainer width="100%" height={alto}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="#EEF1F4" />

          {/* Cuadrante de riesgo: sombreado suave, sin borde duro. */}
          <ReferenceArea
            x1={0} x2={CORTE} y1={0} y2={CORTE}
            fill="#C0392B" fillOpacity={0.07} stroke="none"
          />

          <XAxis
            type="number" dataKey="x" domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false} tickLine={false}
            label={{ value: ejeX, position: 'bottom', offset: 10,
                     style: { fontSize: 11, fill: '#6B7280' } }}
          />
          <YAxis
            type="number" dataKey="y" domain={[0, 100]} width={40}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={false} tickLine={false}
          />
          <ZAxis range={[70, 70]} />
          <Tooltip
            cursor={{ strokeDasharray: '0', stroke: '#E1E5EA' }}
            content={<Emergente ejeX={ejeX} ejeY={ejeY} />}
          />
          <Scatter
            data={datos}
            fill="#2E86DE"
            // Anillo de 2 px del color de la superficie para los puntos que se solapan.
            stroke="#FFFFFF"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <p className="mt-1 text-[11px] text-texto-secundario">
        El área sombreada marca a quienes están por debajo de {CORTE} % en ambos
        indicadores: {enRiesgo.length} de {datos.length} estudiantes.
        Eje vertical: {ejeY}.
      </p>
    </div>
  )
}
