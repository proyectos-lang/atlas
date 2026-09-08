'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { generar, type EstadoGeneracion } from '@/app/asesor/acciones'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-institucional px-4 py-2 text-sm font-medium text-white
                 transition hover:bg-institucional-claro disabled:opacity-60"
    >
      {pending ? 'Generando…' : 'Generar recomendaciones'}
    </button>
  )
}

export function GenerarRecomendaciones({
  cursos,
  estudiantes,
}: {
  cursos: { codigo: string; nombre: string }[]
  estudiantes: { codigo: string; cursoCodigo: string }[]
}) {
  const [estado, accion] = useActionState<EstadoGeneracion, FormData>(generar, {})
  const [curso, setCurso] = useState('')
  const [alcance, setAlcance] = useState<'curso' | 'estudiante'>('curso')

  const campo =
    'rounded-md border border-superficie-borde px-2.5 py-1.5 text-sm outline-none ' +
    'focus:border-institucional focus:ring-1 focus:ring-institucional'

  const visibles = curso
    ? estudiantes.filter((e) => e.cursoCodigo === curso)
    : estudiantes

  return (
    <form action={accion} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-texto-secundario">Alcance</label>
          <select
            value={alcance}
            onChange={(e) => setAlcance(e.target.value as 'curso' | 'estudiante')}
            className={campo}
          >
            <option value="curso">Curso completo</option>
            <option value="estudiante">Un estudiante</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-texto-secundario">Curso</label>
          <select
            name="curso" value={curso}
            onChange={(e) => setCurso(e.target.value)}
            className={campo}
          >
            <option value="">Todos los de mi alcance</option>
            {cursos.map((c) => (
              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {alcance === 'estudiante' && (
          <div>
            <label className="mb-1 block text-xs text-texto-secundario">Estudiante</label>
            <select name="estudiante" required className={campo}>
              <option value="">Selecciona…</option>
              {visibles.map((e) => (
                <option key={e.codigo} value={e.codigo}>{e.codigo}</option>
              ))}
            </select>
          </div>
        )}

        <Boton />
      </div>

      <p className="text-xs text-texto-secundario">
        El asistente analiza las dos competencias con mayor brecha de cada estudiante
        y añade una recomendación grupal cuando más del 40 % del curso está por debajo
        del nivel Alto. Todas quedan pendientes de revisión docente; ninguna se aplica sola.
      </p>

      {estado.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {estado.ok}
        </p>
      )}
    </form>
  )
}
