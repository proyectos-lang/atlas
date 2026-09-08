'use client'

import {
  PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts'

/**
 * Radar de competencias (§8.2).
 * Cinco vértices con los cinco índices, área rellena azul translúcida.
 * Los vértices llevan el nombre completo de la competencia, nunca el código.
 */
export function RadarCompetencias({
  datos,
  alto = 300,
}: {
  datos: { competencia: string; valor: number }[]
  alto?: number
}) {
  if (datos.length === 0) {
    return <p className="text-xs text-texto-secundario">sin resultados aún</p>
  }

  return (
    <ResponsiveContainer width="100%" height={alto}>
      <RadarChart data={datos} outerRadius="72%">
        <PolarGrid stroke="#E1E5EA" />
        <PolarAngleAxis
          dataKey="competencia"
          tick={{ fontSize: 11, fill: '#374151' }}
        />
        <PolarRadiusAxis
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: '#9CA3AF' }}
          axisLine={false}
          tickCount={5}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12, borderRadius: 6,
            border: '1px solid #E1E5EA', boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          }}
          formatter={(v: number) => [`${Number(v).toFixed(1).replace('.', ',')} %`, 'Índice']}
        />
        <Radar
          dataKey="valor"
          stroke="#1F3864"
          strokeWidth={2}
          fill="#2E86DE"
          fillOpacity={0.28}
          isAnimationActive={false}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
