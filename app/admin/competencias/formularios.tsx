'use client'

import { useActionState, useState } from 'react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import {
  crearCompetencia, crearDimension, crearIndicador,
  type EstadoCompetencia,
} from './acciones'

export interface OpcionSimple {
  id: number
  etiqueta: string
  pie?: string
}

const CAMPO =
  'mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2 text-sm ' +
  'outline-none transition focus:border-institucional focus:ring-2 ' +
  'focus:ring-institucional/20'

function Mensajes({ estado }: { estado: EstadoCompetencia }) {
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

export function FormularioCompetencia() {
  const [estado, accion] = useActionState<EstadoCompetencia, FormData>(crearCompetencia, {})
  const [transversal, setTransversal] = useState(true)

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" required placeholder="LD" className={`${CAMPO} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Liderazgo" className={CAMPO} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Descripción <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <textarea name="descripcion" rows={2} className={CAMPO} />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="transversal"
          checked={transversal}
          onChange={(e) => setTransversal(e.target.checked)}
          className="h-4 w-4 rounded border-superficie-borde accent-institucional"
        />
        Es una competencia transversal
      </label>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Student Outcome ABET{' '}
          <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <input name="student_outcome" placeholder="SO3" className={`${CAMPO} uppercase`} />
        <p className="mt-1 text-xs text-texto-secundario">
          Déjalo vacío si esta competencia transversal es{' '}
          <strong>complementaria</strong>: se trabaja en el programa pero no
          corresponde a ningún Student Outcome directo.
        </p>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear competencia</BotonEnvio>
    </form>
  )
}

export function FormularioDimension({ competencias }: { competencias: OpcionSimple[] }) {
  const [estado, accion] = useActionState<EstadoCompetencia, FormData>(crearDimension, {})

  if (competencias.length === 0) {
    return <p className="text-sm text-texto-secundario">No hay competencias configuradas.</p>
  }

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Competencia</label>
        <select name="competencia_id" className={CAMPO}>
          {competencias.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Depuración" className={CAMPO} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Código <span className="font-normal text-texto-secundario">(auto)</span>
          </label>
          <input name="codigo" placeholder="se genera" className={`${CAMPO} uppercase`} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Qué se observa <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <input
          name="descripcion"
          placeholder="Localiza y corrige los errores que encuentra."
          className={CAMPO}
        />
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear dimensión</BotonEnvio>
    </form>
  )
}

/** Qué necesita cada tipo de cálculo, para explicarlo al configurar. */
const AYUDA_AGREGACION: Record<string, string> = {
  Promedio: 'Media de los valores de las evidencias. No necesita nada más.',
  Suma: 'Suma de los valores, dividida entre el valor esperado.',
  Proporcion: 'Cuántas evidencias superan el umbral, sobre el total.',
  Conteo: 'Número de evidencias registradas.',
  Rubrica: 'Suma de lo obtenido sobre suma del máximo posible.',
}

export function FormularioIndicador({ dimensiones }: { dimensiones: OpcionSimple[] }) {
  const [estado, accion] = useActionState<EstadoCompetencia, FormData>(crearIndicador, {})
  const [agregacion, setAgregacion] = useState('Promedio')

  if (dimensiones.length === 0) {
    return <p className="text-sm text-texto-secundario">No hay dimensiones configuradas.</p>
  }

  const pideEsperado = agregacion === 'Suma'
  const pideUmbral = agregacion === 'Proporcion'

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Dimensión</label>
        <select name="dimension_id" className={CAMPO}>
          {dimensiones.map((d) => (
            <option key={d.id} value={d.id}>
              {d.etiqueta}{d.pie ? ` — ${d.pie}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Errores corregidos" className={CAMPO} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Código <span className="font-normal text-texto-secundario">(auto)</span>
          </label>
          <input name="codigo" placeholder="se genera" className={`${CAMPO} uppercase`} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Cómo se calcula</label>
        <select
          name="agregacion"
          value={agregacion}
          onChange={(e) => setAgregacion(e.target.value)}
          className={CAMPO}
        >
          {Object.keys(AYUDA_AGREGACION).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-texto-secundario">
          {AYUDA_AGREGACION[agregacion]}
        </p>
      </div>

      {(pideEsperado || pideUmbral) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {pideEsperado && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Valor esperado <span className="text-red-600">*</span>
              </label>
              <input
                name="valor_esperado"
                type="number"
                step="any"
                required
                placeholder="18"
                className={CAMPO}
              />
              <p className="mt-1 text-xs text-texto-secundario">
                El denominador: lo que se espera que alcance un estudiante.
              </p>
            </div>
          )}
          {pideUmbral && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Umbral <span className="text-red-600">*</span>
              </label>
              <input
                name="umbral"
                type="number"
                step="any"
                required
                placeholder="70"
                className={CAMPO}
              />
              <p className="mt-1 text-xs text-texto-secundario">
                El corte que separa logro de no logro.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Escala</label>
          <select name="escala" className={CAMPO} defaultValue="Porcentaje">
            <option value="Porcentaje">Porcentaje (0–100)</option>
            <option value="Puntos">Puntos (puede ser negativo)</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="trunca_100"
              defaultChecked
              className="h-4 w-4 rounded border-superficie-borde accent-institucional"
            />
            Limitar a 100
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="prorratea"
              className="h-4 w-4 rounded border-superficie-borde accent-institucional"
            />
            Prorratear por semanas
          </label>
        </div>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear indicador</BotonEnvio>
    </form>
  )
}
