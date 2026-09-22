'use client'

import { useActionState, useState } from 'react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import {
  registrarIntervencion, generarRecomendaciones,
  type EstadoIntervencion,
} from './acciones'

export interface Opcion {
  id: number
  etiqueta: string
  pie?: string
}

const CAMPO =
  'mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2 text-sm ' +
  'outline-none transition focus:border-institucional focus:ring-2 ' +
  'focus:ring-institucional/20'

function Mensajes({ estado }: { estado: EstadoIntervencion }) {
  return (
    <>
      {estado.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {estado.ok}
        </p>
      )}
    </>
  )
}

export function FormularioIntervencion({
  cursos,
  estudiantes,
  dimensiones,
  indicadores,
  estrategias,
}: {
  cursos: Opcion[]
  estudiantes: Opcion[]
  dimensiones: Opcion[]
  indicadores: Opcion[]
  estrategias: readonly string[]
}) {
  const [estado, accion] = useActionState<EstadoIntervencion, FormData>(
    registrarIntervencion, {}
  )
  const [indicador, setIndicador] = useState('')

  if (cursos.length === 0) {
    return <p className="text-sm text-texto-secundario">No hay cursos en tu alcance.</p>
  }

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Curso</label>
          <select name="curso_id" className={CAMPO}>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.etiqueta}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Estudiante <span className="font-normal text-texto-secundario">(opcional)</span>
          </label>
          <select name="usuario_id" className={CAMPO} defaultValue="">
            <option value="">Todo el curso (grupal)</option>
            {estudiantes.map((e) => (
              <option key={e.id} value={e.id}>{e.etiqueta}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Dimensión que se ataca
          </label>
          <select name="dimension_id" className={CAMPO} defaultValue="">
            <option value="">Sin especificar</option>
            {dimensiones.map((d) => (
              <option key={d.id} value={d.id}>
                {d.etiqueta}{d.pie ? ` — ${d.pie}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Indicador a medir
          </label>
          <select
            name="indicador_id"
            value={indicador}
            onChange={(e) => setIndicador(e.target.value)}
            className={CAMPO}
          >
            <option value="">Sin indicador</option>
            {indicadores.map((i) => (
              <option key={i.id} value={i.id}>
                {i.etiqueta}{i.pie ? ` — ${i.pie}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!indicador && (
        <p className="rounded-md border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Sin indicador asociado la intervención queda registrada, pero{' '}
          <strong>no se podrá medir su efecto</strong>: no habrá contra qué
          comparar.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Qué se va a hacer
        </label>
        <textarea
          name="descripcion"
          required
          rows={3}
          placeholder="Sesiones de depuración guiada en pareja: uno ejecuta y el otro narra en voz alta qué error sospecha y por qué."
          className={CAMPO}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Estrategia <span className="font-normal text-texto-secundario">(opcional)</span>
          </label>
          <select name="estrategia" className={CAMPO} defaultValue="">
            <option value="">Sin especificar</option>
            {estrategias.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Fecha de inicio <span className="font-normal text-texto-secundario">(opcional)</span>
          </label>
          <input name="fecha_inicio" type="date" className={CAMPO} />
        </div>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Registrando…">Registrar intervención</BotonEnvio>
    </form>
  )
}

export function BotonGenerar({ estudiantes }: { estudiantes: Opcion[] }) {
  const [estado, accion] = useActionState<EstadoIntervencion, FormData>(
    generarRecomendaciones, {}
  )

  return (
    <form action={accion} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Ámbito <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <select name="usuario_id" className={CAMPO} defaultValue="">
          <option value="">Todo mi alcance</option>
          {estudiantes.map((e) => (
            <option key={e.id} value={e.id}>{e.etiqueta}</option>
          ))}
        </select>
      </div>

      <Mensajes estado={estado} />

      <BotonEnvio enProgreso="Generando…" variante="secundario">
        Generar recomendaciones
      </BotonEnvio>
    </form>
  )
}
