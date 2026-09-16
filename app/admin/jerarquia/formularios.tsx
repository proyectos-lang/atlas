'use client'

import { useActionState, useState } from 'react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { crearPrograma, crearGrupo, type EstadoJerarquia } from './acciones'

export interface Opcion {
  id: number
  etiqueta: string
  /** Contexto secundario: universidad del curso, programa del curso… */
  pie?: string
}

const CAMPO =
  'mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2 text-sm ' +
  'outline-none transition focus:border-institucional focus:ring-2 ' +
  'focus:ring-institucional/20'

function Mensajes({ estado }: { estado: EstadoJerarquia }) {
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

export function FormularioPrograma({ universidades }: { universidades: Opcion[] }) {
  const [estado, accion] = useActionState<EstadoJerarquia, FormData>(crearPrograma, {})

  if (universidades.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">
        No hay universidades visibles en tu alcance.
      </p>
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Universidad</label>
        <select name="universidad_id" required className={CAMPO}>
          {universidades.map((u) => (
            <option key={u.id} value={u.id}>{u.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Código</label>
          <input
            name="codigo"
            required
            placeholder="P04"
            className={`${CAMPO} uppercase`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input
            name="nombre"
            required
            placeholder="Ingeniería Industrial"
            className={CAMPO}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Modalidad <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <select name="modalidad" className={CAMPO} defaultValue="">
          <option value="">Sin especificar</option>
          <option value="Virtual">Virtual</option>
          <option value="Híbrida">Híbrida</option>
          <option value="Presencial">Presencial</option>
        </select>
      </div>

      <Mensajes estado={estado} />

      <BotonEnvio enProgreso="Creando…">Crear programa</BotonEnvio>
    </form>
  )
}

export function FormularioGrupo({
  cursos,
  docentes,
}: {
  cursos: Opcion[]
  docentes: Opcion[]
}) {
  const [estado, accion] = useActionState<EstadoJerarquia, FormData>(crearGrupo, {})
  const [curso, setCurso] = useState(cursos[0]?.id ?? 0)

  if (cursos.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">
        No hay cursos visibles en tu alcance.
      </p>
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Curso</label>
        <select
          name="curso_id"
          value={curso}
          onChange={(e) => setCurso(Number(e.target.value))}
          className={CAMPO}
        >
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}{c.pie ? ` — ${c.pie}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Grupo 2" className={CAMPO} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Código <span className="font-normal text-texto-secundario">(auto)</span>
          </label>
          <input
            name="codigo"
            placeholder="se genera solo"
            className={`${CAMPO} uppercase`}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Docente <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <select name="docente_id" className={CAMPO} defaultValue="">
          <option value="">Sin asignar</option>
          {docentes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.etiqueta}{d.pie ? ` — ${d.pie}` : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-texto-secundario">
          Asignar el docente aquí lo deja registrado como responsable del grupo.
          Para que además <strong>vea sólo ese grupo</strong>, hay que darle el
          grupo como alcance en Perfiles de acceso.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Periodo <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <input name="periodo" placeholder="2026-1" className={CAMPO} />
      </div>

      <Mensajes estado={estado} />

      <BotonEnvio enProgreso="Creando…">Crear grupo</BotonEnvio>
    </form>
  )
}
