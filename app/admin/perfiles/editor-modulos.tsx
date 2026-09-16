'use client'

import { useActionState, useState } from 'react'
import { SelectorModulos, type GrupoModulos } from '@/componentes/selector-modulos'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { guardarModulos, type EstadoPerfil } from './acciones'

/**
 * Edición de módulos de un perfil ya creado, plegada dentro de su fila.
 *
 * Va en un `<details>` para que la tabla siga siendo legible: sólo se
 * despliega el perfil que se está ajustando.
 */
export function EditorModulos({
  perfilId,
  nombre,
  grupos,
  porDefecto,
  seleccionActual,
  personalizado,
}: {
  perfilId: number
  nombre: string
  grupos: GrupoModulos[]
  /** Módulos del rol, para el botón «Los de su rol». */
  porDefecto: string[]
  /** Selección vigente: los personalizados, o los del rol si no los hay. */
  seleccionActual: string[]
  personalizado: boolean
}) {
  const [estado, accion] = useActionState<EstadoPerfil, FormData>(guardarModulos, {})
  const [abierto, setAbierto] = useState(false)

  return (
    <details
      open={abierto}
      onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open)}
      className="mt-1"
    >
      <summary className="cursor-pointer text-xs text-institucional underline underline-offset-2">
        {personalizado
          ? `Módulos: ${seleccionActual.length} personalizados`
          : 'Módulos: los de su rol'}
      </summary>

      <form action={accion} className="mt-2">
        <input type="hidden" name="id" value={String(perfilId)} />

        <SelectorModulos
          grupos={grupos}
          porDefecto={porDefecto}
          seleccionInicial={seleccionActual}
        />

        {estado.error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
            {estado.error}
          </p>
        )}
        {estado.ok && (
          <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">
            {estado.ok}
          </p>
        )}

        <div className="mt-2">
          <BotonEnvio enProgreso="Guardando…" tamano="sm">
            Guardar módulos de {nombre}
          </BotonEnvio>
        </div>
      </form>
    </details>
  )
}
