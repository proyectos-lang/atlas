'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { generar, type EstadoGeneracion } from '@/app/recomendador/acciones'
import { BadgeNivel } from './graficos/base'

export interface UniversidadOpc {
  codigo: string
  nombre: string
  programa: string
}

export interface CursoOpc {
  codigo: string
  nombre: string
  universidadCodigo: string
}

export interface EstudianteOpc {
  codigo: string
  cursoCodigo: string
  ctg: number
  competenciasBajoAlto: number
}

function Boton({ etiqueta }: { etiqueta: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-institucional px-4 py-2 text-sm font-medium text-white
                 transition hover:bg-institucional-claro disabled:opacity-60"
    >
      {pending ? 'Generando… puede tardar un minuto' : etiqueta}
    </button>
  )
}

/**
 * Selección encadenada universidad -> curso -> estudiantes.
 * Se puede pedir el curso completo o un estudiante concreto.
 */
export function PanelRecomendador({
  universidades,
  cursos,
  estudiantes,
}: {
  universidades: UniversidadOpc[]
  cursos: CursoOpc[]
  estudiantes: EstudianteOpc[]
}) {
  const [estado, accion] = useActionState<EstadoGeneracion, FormData>(generar, {})
  const [universidad, setUniversidad] = useState('')
  const [curso, setCurso] = useState('')
  const [destino, setDestino] = useState<'curso' | 'estudiante'>('curso')
  const [estudiante, setEstudiante] = useState('')

  // Encadenado: la universidad reduce los cursos, el curso los estudiantes.
  const cursosVisibles = useMemo(
    () => (universidad ? cursos.filter((c) => c.universidadCodigo === universidad) : cursos),
    [cursos, universidad]
  )

  const estudiantesVisibles = useMemo(() => {
    const codigos = new Set(cursosVisibles.map((c) => c.codigo))
    return estudiantes
      .filter((e) => (curso ? e.cursoCodigo === curso : codigos.has(e.cursoCodigo)))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [estudiantes, cursosVisibles, curso])

  // Sin competencias bajo Alto no hay nada que recomendar.
  const conBrecha = estudiantesVisibles.filter((e) => e.competenciasBajoAlto > 0)

  const campo =
    'w-full rounded-md border border-superficie-borde px-2.5 py-1.5 text-sm outline-none ' +
    'focus:border-institucional focus:ring-1 focus:ring-institucional'

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            1 · Universidad
          </label>
          <select
            name="universidad"
            value={universidad}
            onChange={(e) => { setUniversidad(e.target.value); setCurso(''); setEstudiante('') }}
            className={campo}
          >
            <option value="">Todas las de mi alcance</option>
            {universidades.map((u) => (
              <option key={u.codigo} value={u.codigo}>
                {u.nombre} — {u.programa}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            2 · Curso
          </label>
          <select
            name="curso"
            value={curso}
            onChange={(e) => { setCurso(e.target.value); setEstudiante('') }}
            className={campo}
          >
            <option value="">Todos ({cursosVisibles.length})</option>
            {cursosVisibles.map((c) => (
              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            3 · Para quién
          </label>
          <select
            name="destino"
            value={destino}
            onChange={(e) => setDestino(e.target.value as 'curso' | 'estudiante')}
            className={campo}
          >
            <option value="curso">Grupo completo</option>
            <option value="estudiante">Un estudiante</option>
          </select>
        </div>
      </div>

      {/* Lista de estudiantes del ámbito */}
      <div className="rounded-md border border-superficie-borde">
        <div className="flex items-center justify-between border-b border-superficie-borde px-3 py-2">
          <p className="text-xs font-medium text-slate-700">
            {destino === 'estudiante'
              ? 'Selecciona el estudiante'
              : `Estudiantes del ámbito (${estudiantesVisibles.length})`}
          </p>
          <p className="text-xs text-texto-secundario">
            {conBrecha.length} con competencias bajo el nivel Alto
          </p>
        </div>

        {estudiantesVisibles.length === 0 ? (
          <p className="px-3 py-4 text-xs text-texto-secundario">
            No hay estudiantes en este ámbito.
          </p>
        ) : (
          <ul className="max-h-64 divide-y divide-superficie-borde/60 overflow-y-auto">
            {estudiantesVisibles.map((e) => {
              const elegible = e.competenciasBajoAlto > 0
              const id = `est-${e.codigo}`
              return (
                <li
                  key={e.codigo}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${
                    !elegible ? 'opacity-55' : ''
                  }`}
                >
                  {/* El input va fuera del <label> y se enlaza con htmlFor:
                      anidarlo dentro de una etiqueta que envuelve más
                      elementos hacía que el clic se asociara al formulario
                      de la cabecera y se enviara la acción equivocada. */}
                  {destino === 'estudiante' && (
                    <input
                      id={id}
                      type="radio"
                      name="estudiante"
                      value={e.codigo}
                      checked={estudiante === e.codigo}
                      disabled={!elegible}
                      onChange={() => setEstudiante(e.codigo)}
                      className="accent-institucional"
                    />
                  )}
                  <label
                    htmlFor={destino === 'estudiante' ? id : undefined}
                    className={`flex flex-1 items-center gap-3 ${
                      destino === 'estudiante' && elegible ? 'cursor-pointer' : ''
                    }`}
                  >
                    <span className="w-16 font-medium text-slate-700">{e.codigo}</span>
                    <span className="w-20 tabular-nums text-texto-secundario">
                      {e.ctg.toFixed(1).replace('.', ',')} %
                    </span>
                    <BadgeNivel valor={e.ctg} />
                    <span className="ml-auto text-xs text-texto-secundario">
                      {elegible
                        ? `${e.competenciasBajoAlto} competencia${e.competenciasBajoAlto > 1 ? 's' : ''} bajo Alto`
                        : 'sin brechas'}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* type="submit" explícito: sin él, un botón dentro de un <label>
            anidado puede asociarse al formulario equivocado del layout. */}
        <Boton
          etiqueta={
            destino === 'estudiante'
              ? 'Generar para el estudiante'
              : `Generar para ${conBrecha.length} estudiante${conBrecha.length === 1 ? '' : 's'}`
          }
        />
        <p className="text-xs text-texto-secundario">
          {destino === 'curso'
            ? 'Incluye una recomendación grupal cuando más del 40 % del curso está bajo el nivel Alto.'
            : 'Sólo recomendaciones individuales.'}
        </p>
      </div>

      <p className="text-xs text-texto-secundario">
        El asistente analiza las dos competencias con mayor brecha de cada estudiante y
        se apoya en su sub-indicador peor evaluado. Todas las recomendaciones se guardan
        como <strong>pendientes de revisión docente</strong>: ninguna se aplica sola.
      </p>

      {estado.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <p>{estado.ok}</p>
          {estado.detalle && estado.detalle.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {estado.detalle.map((d, i) => (
                <li key={i}>· {d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}
