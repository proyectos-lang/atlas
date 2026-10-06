'use client'

import { useState } from 'react'

/**
 * Selector del docente de un grupo, con la opción de crearlo ahí mismo.
 *
 * Envía `docente_id` (id, vacío o 'nuevo') y, si es nuevo,
 * `docente_nombre`, `docente_email` y `docente_password`. Lo procesa
 * `crearGrupo`. Existe porque el usuario, al crear un grupo, no
 * encontraba al docente: todavía no tenía cuenta y crearla en Perfiles le
 * pedía un grupo que aún no existía.
 */

interface Opcion {
  id: number
  etiqueta: string
  pie?: string
}

export function SelectorDocente({
  docentes,
  campo,
}: {
  docentes: Opcion[]
  /** Clases del input, para que encaje con el formulario que lo contiene. */
  campo: string
}) {
  // Sin docentes registrados, lo útil por defecto es crear uno.
  const [valor, setValor] = useState(docentes.length === 0 ? 'nuevo' : '')
  const nuevo = valor === 'nuevo'

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Docente <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <select
          name="docente_id"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={campo}
        >
          <option value="">Sin asignar por ahora</option>
          <option value="nuevo">+ Crear un docente nuevo</option>
          {docentes.length > 0 && (
            <optgroup label="Docentes registrados">
              {docentes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.etiqueta}{d.pie ? ` — ${d.pie}` : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="mt-1 text-xs text-texto-secundario">
          El docente asignado verá <strong>sólo los estudiantes de este grupo</strong>.
          Si no aparece en la lista es porque aún no tiene cuenta: créalo aquí.
        </p>
      </div>

      {nuevo && (
        <fieldset className="space-y-3 rounded-lg border border-institucional/20 bg-institucional-suave/40 p-3">
          <legend className="px-1 text-xs font-semibold text-institucional">
            Cuenta del docente nuevo
          </legend>
          <div>
            <label className="block text-sm font-medium text-slate-700">Nombre completo</label>
            <input name="docente_nombre" required placeholder="María Pérez" className={campo} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Correo</label>
              <input
                name="docente_email" type="email" required
                placeholder="maria.perez@universidad.edu" className={campo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Contraseña inicial</label>
              <input
                name="docente_password" type="text" required minLength={8}
                placeholder="mínimo 8 caracteres" className={campo}
              />
            </div>
          </div>
          <p className="text-xs text-texto-secundario">
            Con este correo y contraseña entrará a ATLAS. Compártelos con el docente.
          </p>
        </fieldset>
      )}
    </div>
  )
}
