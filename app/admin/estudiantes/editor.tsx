'use client'

import { useActionState } from 'react'
import { Pencil } from 'lucide-react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { editarEstudiante, type EstadoEstudiante } from './acciones'

const CAMPO =
  'mt-1 w-full rounded-md border border-superficie-borde bg-white px-2.5 py-1.5 ' +
  'text-sm outline-none transition focus:border-institucional ' +
  'focus:ring-2 focus:ring-institucional/20'

/** Lápiz de cada fila del listado de estudiantes. */
export function EditorEstudiante({
  id, codigo, nombre, semestre, grupoId, grupos,
}: {
  id: number
  codigo: string
  nombre: string
  semestre: number | null
  grupoId: number | null
  grupos: { id: number; etiqueta: string }[]
}) {
  const [estado, accion] = useActionState<EstadoEstudiante, FormData>(editarEstudiante, {})

  return (
    <details>
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1
                   text-xs text-institucional transition hover:bg-institucional-suave"
        title={`Editar ${nombre}`}
      >
        <Pencil size={13} aria-hidden />
        <span className="sr-only sm:not-sr-only">Editar</span>
      </summary>

      <form action={accion} className="mt-2 w-72 space-y-2 rounded-md border border-superficie-borde bg-white p-3 text-left sm:w-96">
        <input type="hidden" name="id" value={String(id)} />
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <div>
            <label className="block text-xs font-medium text-slate-700">Código</label>
            <input name="codigo" required defaultValue={codigo} className={CAMPO} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Nombre</label>
            <input name="nombre" required defaultValue={nombre} className={CAMPO} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <div>
            <label className="block text-xs font-medium text-slate-700">Semestre</label>
            <input name="semestre" type="number" min={1} max={20} defaultValue={semestre ?? ''} className={CAMPO} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Grupo</label>
            <select name="grupo_id" defaultValue={grupoId ?? ''} className={CAMPO}>
              {grupoId === null && <option value="">Sin grupo</option>}
              {grupos.map((g) => <option key={g.id} value={g.id}>{g.etiqueta}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-texto-secundario">
          Cambiar de grupo lo mueve también al curso de ese grupo. Su historial se conserva.
        </p>

        {estado.error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">{estado.error}</p>
        )}
        {estado.ok && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-800">{estado.ok}</p>
        )}
        <BotonEnvio tamano="sm" enProgreso="Guardando…">Guardar cambios</BotonEnvio>
      </form>
    </details>
  )
}
