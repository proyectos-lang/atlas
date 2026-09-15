'use client'

import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { useActionState, useState } from 'react'
import { guardarPerfilEgreso, type EstadoPerfilEgreso } from './acciones'

export interface ProgramaOpcion {
  id: number
  etiqueta: string
  perfilEgreso: string
  notas: string
  activo: boolean
}

export function FormularioPerfilEgreso({ programas }: { programas: ProgramaOpcion[] }) {
  const [estado, accion] = useActionState<EstadoPerfilEgreso, FormData>(
    guardarPerfilEgreso,
    {}
  )

  const [seleccionado, setSeleccionado] = useState(programas[0]?.id ?? 0)
  const actual = programas.find((p) => p.id === seleccionado)

  // El textarea se remonta al cambiar de programa (key): sin esto React
  // conservaría el texto del programa anterior en el campo.
  const [texto, setTexto] = useState(actual?.perfilEgreso ?? '')

  const campo =
    'mt-1 w-full rounded-md border border-superficie-borde px-3 py-2 text-sm ' +
    'outline-none focus:border-institucional focus:ring-1 focus:ring-institucional'

  if (programas.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">
        No hay programas visibles en tu alcance.
      </p>
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Universidad y programa
        </label>
        <select
          name="universidad_id"
          value={seleccionado}
          onChange={(e) => {
            const id = Number(e.target.value)
            setSeleccionado(id)
            setTexto(programas.find((p) => p.id === id)?.perfilEgreso ?? '')
          }}
          className={campo}
        >
          {programas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.etiqueta}
              {p.perfilEgreso ? '' : '  (sin perfil de egreso)'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Perfil de egreso
        </label>
        <p className="mt-0.5 text-xs text-texto-secundario">
          Pega el perfil tal como aparece en el documento curricular. El agente
          lo lee entero: no hace falta resumirlo ni darle formato.
        </p>
        <textarea
          key={seleccionado}
          name="perfil_egreso"
          required
          rows={14}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            'El egresado del programa está en capacidad de…\n\n' +
            '· Competencia 1: …\n· Competencia 2: …'
          }
          className={`${campo} font-normal leading-relaxed`}
        />
        <p className="mt-1 text-xs text-texto-secundario">
          {texto.trim().length} caracteres
          {texto.trim().length > 0 && texto.trim().length < 20 && (
            <span className="text-nivel-basico"> · mínimo 20</span>
          )}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Notas para el análisis <span className="font-normal">(opcional)</span>
        </label>
        <p className="mt-0.5 text-xs text-texto-secundario">
          Énfasis o contexto que el agente deba tener en cuenta y que no forme
          parte del perfil de egreso.
        </p>
        <textarea
          key={`notas-${seleccionado}`}
          name="notas"
          rows={3}
          defaultValue={actual?.notas ?? ''}
          className={campo}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          key={`activo-${seleccionado}`}
          type="checkbox"
          name="activo"
          defaultChecked={actual?.activo ?? true}
          className="h-4 w-4 rounded border-superficie-borde"
        />
        Usar este perfil de egreso en el análisis de IA
      </label>

      {estado.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {estado.ok}
        </p>
      )}

      <BotonEnvio enProgreso="Guardando…">Guardar perfil de egreso</BotonEnvio>
    </form>
  )
}
