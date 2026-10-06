'use client'

import { useActionState, useState } from 'react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import {
  editarEntidad, eliminarEntidad, alternarEntidad, type EstadoEntidad,
} from '@/app/admin/acciones-entidad'

/**
 * Edición y eliminación en línea de cualquier entidad de la lista blanca.
 *
 * Se pliega bajo un «Editar» para no cargar las listas: sólo se despliega
 * la fila que se está cambiando. Los campos llegan ya definidos desde el
 * servidor, con sus valores actuales.
 *
 * Eliminar pide confirmación en dos pasos, y el servidor exige el testigo
 * del segundo: un clic accidental no borra nada.
 */

export interface CampoEditor {
  columna: string
  etiqueta: string
  tipo: 'texto' | 'largo' | 'numero' | 'opcion'
  valor: string
  opciones?: readonly string[]
}

const CAMPO =
  'mt-1 w-full rounded-md border border-superficie-borde bg-white px-2.5 py-1.5 ' +
  'text-sm outline-none transition focus:border-institucional ' +
  'focus:ring-2 focus:ring-institucional/20'

export function EditorEntidad({
  tabla,
  id,
  nombre,
  campos,
  activo,
  compacto = false,
}: {
  tabla: string
  id: number
  /** Cómo se llama la fila, para los textos de confirmación. */
  nombre: string
  campos: CampoEditor[]
  /** Si la entidad admite desactivarse, su estado actual. */
  activo?: boolean
  /** Enlaces más pequeños, para listas densas. */
  compacto?: boolean
}) {
  const [estadoEdicion, editar] = useActionState<EstadoEntidad, FormData>(editarEntidad, {})
  const [estadoBorrado, eliminar] = useActionState<EstadoEntidad, FormData>(eliminarEntidad, {})
  const [confirmando, setConfirmando] = useState(false)

  const enlace = compacto
    ? 'text-[11px] text-institucional underline underline-offset-2'
    : 'text-xs text-institucional underline underline-offset-2'

  return (
    <details className="group mt-1">
      <summary className={`cursor-pointer list-none ${enlace}`}>
        Editar
      </summary>

      <div className="mt-2 rounded-md border border-superficie-borde bg-white p-3">
        <form action={editar} className="space-y-3">
          <input type="hidden" name="tabla" value={tabla} />
          <input type="hidden" name="id" value={String(id)} />

          <div className="grid gap-3 sm:grid-cols-2">
            {campos.map((c) => (
              <div key={c.columna} className={c.tipo === 'largo' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-700">
                  {c.etiqueta}
                </label>

                {c.tipo === 'largo' ? (
                  <textarea
                    name={c.columna}
                    rows={3}
                    defaultValue={c.valor}
                    className={CAMPO}
                  />
                ) : c.tipo === 'opcion' ? (
                  <select name={c.columna} defaultValue={c.valor} className={CAMPO}>
                    <option value="">Sin especificar</option>
                    {(c.opciones ?? []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={c.columna}
                    type={c.tipo === 'numero' ? 'number' : 'text'}
                    step={c.tipo === 'numero' ? 'any' : undefined}
                    defaultValue={c.valor}
                    className={`${CAMPO}${c.columna === 'codigo' ? ' uppercase' : ''}`}
                  />
                )}
              </div>
            ))}
          </div>

          {estadoEdicion.error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
              {estadoEdicion.error}
            </p>
          )}
          {estadoEdicion.ok && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
              {estadoEdicion.ok}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <BotonEnvio tamano="sm" enProgreso="Guardando…">Guardar cambios</BotonEnvio>

            {activo !== undefined && (
              <button
                type="submit"
                formAction={alternarEntidad}
                className="text-xs text-institucional underline underline-offset-2"
              >
                {activo ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>
        </form>

        {/* ---------- Eliminar, en dos pasos ---------- */}
        <div className="mt-3 border-t border-superficie-borde pt-3">
          {!confirmando ? (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="text-xs text-red-700 underline underline-offset-2"
            >
              Eliminar
            </button>
          ) : (
            <form action={eliminar} className="space-y-2">
              <input type="hidden" name="tabla" value={tabla} />
              <input type="hidden" name="id" value={String(id)} />
              <input type="hidden" name="confirmado" value="1" />

              <p className="text-xs text-red-800">
                ¿Eliminar <strong>{nombre}</strong>? No se puede deshacer. Si
                tiene registros que dependen de ello, se te dirá cuáles.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <BotonEnvio tamano="sm" variante="peligro" enProgreso="Eliminando…">
                  Sí, eliminar
                </BotonEnvio>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="text-xs text-texto-secundario underline underline-offset-2"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {estadoBorrado.error && (
            <p role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {estadoBorrado.error}
            </p>
          )}
          {estadoBorrado.ok && (
            <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
              {estadoBorrado.ok}
            </p>
          )}
        </div>
      </div>
    </details>
  )
}
