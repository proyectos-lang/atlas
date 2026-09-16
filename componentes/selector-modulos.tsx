'use client'

import { useState } from 'react'

export interface GrupoModulos {
  titulo: string
  items: { ruta: string; etiqueta: string; pie?: string }[]
}

/**
 * Selector de módulos visibles para un perfil.
 *
 * El rol propone el valor de partida y el administrador lo ajusta. Emite un
 * campo `modulos` por cada casilla marcada, más un `modulos_presente` que
 * distingue "no marcó ninguno" de "el formulario no traía el campo": sin
 * ese testigo, un perfil al que se le quitan todos los módulos llegaría al
 * servidor igual que uno sin personalizar, y recuperaría los de su rol.
 */
export function SelectorModulos({
  grupos,
  porDefecto,
  seleccionInicial,
}: {
  grupos: GrupoModulos[]
  /** Módulos del rol. Se usan al pulsar "Restablecer". */
  porDefecto: string[]
  /** Selección actual. Si no se pasa, se parte de `porDefecto`. */
  seleccionInicial?: string[]
}) {
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(seleccionInicial ?? porDefecto)
  )

  const alternar = (ruta: string) => {
    setMarcados((previo) => {
      const siguiente = new Set(previo)
      if (siguiente.has(ruta)) siguiente.delete(ruta)
      else siguiente.add(ruta)
      return siguiente
    })
  }

  const total = grupos.reduce((t, g) => t + g.items.length, 0)

  return (
    <div>
      <input type="hidden" name="modulos_presente" value="1" />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-texto-secundario">
          {marcados.size} de {total} módulos
        </span>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setMarcados(new Set(porDefecto))}
            className="text-institucional underline underline-offset-2"
          >
            Los de su rol
          </button>
          <button
            type="button"
            onClick={() => setMarcados(new Set(grupos.flatMap((g) => g.items.map((i) => i.ruta))))}
            className="text-institucional underline underline-offset-2"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setMarcados(new Set())}
            className="text-institucional underline underline-offset-2"
          >
            Ninguno
          </button>
        </div>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border
                      border-superficie-borde p-3">
        {grupos.map((g) => (
          <fieldset key={g.titulo}>
            <legend className="text-[11px] font-semibold uppercase tracking-wider
                               text-texto-secundario">
              {g.titulo}
            </legend>
            <div className="mt-1.5 space-y-1">
              {g.items.map((i) => {
                const marcado = marcados.has(i.ruta)
                const delRol = porDefecto.includes(i.ruta)

                return (
                  <label
                    key={i.ruta}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5
                               transition hover:bg-institucional-suave"
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(i.ruta)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-superficie-borde
                                 accent-institucional"
                    />
                    {marcado && <input type="hidden" name="modulos" value={i.ruta} />}
                    <span className="min-w-0">
                      <span className="block text-sm leading-tight text-slate-800">
                        {i.etiqueta}
                        {!delRol && marcado && (
                          <span className="ml-1.5 text-[10px] font-medium text-amber-700">
                            fuera de su rol
                          </span>
                        )}
                      </span>
                      {i.pie && (
                        <span className="mt-0.5 block text-[11px] leading-tight text-texto-secundario">
                          {i.pie}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {marcados.size === 0 && (
        <p className="mt-2 rounded-md border-l-2 border-amber-400 bg-amber-50 px-3 py-2
                      text-xs text-amber-900">
          Sin ningún módulo, este perfil podrá iniciar sesión pero no verá
          ninguna sección.
        </p>
      )}

      <p className="mt-2 text-xs text-texto-secundario">
        Conceder un módulo abre la <strong>pantalla</strong>, no los datos. El
        alcance sigue mandando sobre qué información aparece en ella: un docente
        con el tablero institucional lo verá con los datos de su curso.
      </p>
    </div>
  )
}
