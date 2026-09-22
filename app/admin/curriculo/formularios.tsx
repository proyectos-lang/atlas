'use client'

import { useActionState, useState } from 'react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import {
  crearInstitucion, crearFacultad, guardarMacro,
  crearArea, crearLinea, ubicarCurso,
  guardarMicro, crearUnidad, crearResultado,
  type EstadoCurriculo,
} from './acciones'

export interface Opcion {
  id: number
  etiqueta: string
  pie?: string
}

export interface FichaMacro {
  programaId: number
  facultadId: number | null
  perfilEgreso: string
  propositos: string
  planEstudios: string
  modalidad: string
  nivel: string
  duracionSemestres: number | null
  abetAdoptado: boolean
}

export interface FichaMicro {
  cursoId: number
  descripcion: string
  justificacion: string
  metodologia: string
  evaluacion: string
}

const CAMPO =
  'mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2 text-sm ' +
  'outline-none transition focus:border-institucional focus:ring-2 ' +
  'focus:ring-institucional/20'

function Mensajes({ estado }: { estado: EstadoCurriculo }) {
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

function Sin({ que }: { que: string }) {
  return <p className="text-sm text-texto-secundario">Primero hay que crear {que}.</p>
}

// ---------- MACRO ----------

export function FormularioInstitucion({ universidades }: { universidades: Opcion[] }) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(crearInstitucion, {})

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" required placeholder="INS01" className={`${CAMPO} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Universidad Nacional" className={CAMPO} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Siglas <span className="font-normal text-texto-secundario">(opcional)</span>
          </label>
          <input name="siglas" placeholder="UN" className={CAMPO} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            País <span className="font-normal text-texto-secundario">(opcional)</span>
          </label>
          <input name="pais" placeholder="Colombia" className={CAMPO} />
        </div>
      </div>

      {universidades.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Corresponde a{' '}
            <span className="font-normal text-texto-secundario">(opcional)</span>
          </label>
          <select name="universidad_id" className={CAMPO} defaultValue="">
            <option value="">Sin vincular</option>
            {universidades.map((u) => (
              <option key={u.id} value={u.id}>{u.etiqueta}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-texto-secundario">
            Enlaza esta institución con una universidad del modelo anterior,
            mientras coexistan ambos.
          </p>
        </div>
      )}

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear institución</BotonEnvio>
    </form>
  )
}

export function FormularioFacultad({ instituciones }: { instituciones: Opcion[] }) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(crearFacultad, {})

  if (instituciones.length === 0) return <Sin que="una institución" />

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Institución</label>
        <select name="institucion_id" className={CAMPO}>
          {instituciones.map((i) => (
            <option key={i.id} value={i.id}>{i.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" required placeholder="FAC01" className={`${CAMPO} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Facultad de Ingeniería" className={CAMPO} />
        </div>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear facultad</BotonEnvio>
    </form>
  )
}

export function FormularioMacro({
  programas,
  facultades,
  fichas,
}: {
  programas: Opcion[]
  facultades: Opcion[]
  fichas: FichaMacro[]
}) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(guardarMacro, {})
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? 0)

  if (programas.length === 0) return <Sin que="un programa" />

  const ficha = fichas.find((f) => f.programaId === programaId)

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Programa</label>
        <select
          name="programa_id"
          value={programaId}
          onChange={(e) => setProgramaId(Number(e.target.value))}
          className={CAMPO}
        >
          {programas.map((p) => (
            <option key={p.id} value={p.id}>{p.etiqueta}</option>
          ))}
        </select>
      </div>

      {/* key: al cambiar de programa se remonta con sus propios datos. */}
      <div key={programaId} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Facultad</label>
            <select
              name="facultad_id"
              className={CAMPO}
              defaultValue={ficha?.facultadId ?? ''}
            >
              <option value="">Sin asignar</option>
              {facultades.map((f) => (
                <option key={f.id} value={f.id}>{f.etiqueta}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Nivel</label>
            <select name="nivel" className={CAMPO} defaultValue={ficha?.nivel ?? ''}>
              <option value="">Sin especificar</option>
              <option value="Pregrado">Pregrado</option>
              <option value="Especialización">Especialización</option>
              <option value="Maestría">Maestría</option>
              <option value="Doctorado">Doctorado</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Modalidad</label>
            <select name="modalidad" className={CAMPO} defaultValue={ficha?.modalidad ?? ''}>
              <option value="">Sin especificar</option>
              <option value="Virtual">Virtual</option>
              <option value="Híbrida">Híbrida</option>
              <option value="Presencial">Presencial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Duración (semestres)
            </label>
            <input
              name="duracion_semestres"
              type="number"
              min="1"
              className={CAMPO}
              defaultValue={ficha?.duracionSemestres ?? ''}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Perfil de egreso</label>
          <textarea
            name="perfil_egreso"
            rows={5}
            className={CAMPO}
            defaultValue={ficha?.perfilEgreso ?? ''}
            placeholder="El egresado está en capacidad de…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Propósitos de formación
          </label>
          <textarea
            name="propositos"
            rows={3}
            className={CAMPO}
            defaultValue={ficha?.propositos ?? ''}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Plan general de estudios
          </label>
          <textarea
            name="plan_estudios"
            rows={3}
            className={CAMPO}
            defaultValue={ficha?.planEstudios ?? ''}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="abet_adoptado"
            defaultChecked={ficha?.abetAdoptado ?? false}
            className="h-4 w-4 rounded border-superficie-borde accent-institucional"
          />
          El programa ha adoptado los Student Outcomes de ABET
        </label>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Guardando…">Guardar datos macro</BotonEnvio>
    </form>
  )
}

// ---------- MESO ----------

export function FormularioArea({ programas }: { programas: Opcion[] }) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(crearArea, {})

  if (programas.length === 0) return <Sin que="un programa" />

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Programa</label>
        <select name="programa_id" className={CAMPO}>
          {programas.map((p) => (
            <option key={p.id} value={p.id}>{p.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" required placeholder="AR01" className={`${CAMPO} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Formación básica" className={CAMPO} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Tipo</label>
        <select name="tipo" className={CAMPO} defaultValue="Área">
          <option value="Área">Área</option>
          <option value="Componente">Componente</option>
        </select>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear área</BotonEnvio>
    </form>
  )
}

export function FormularioLinea({ programas }: { programas: Opcion[] }) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(crearLinea, {})

  if (programas.length === 0) return <Sin que="un programa" />

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Programa</label>
        <select name="programa_id" className={CAMPO}>
          {programas.map((p) => (
            <option key={p.id} value={p.id}>{p.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" required placeholder="LC01" className={`${CAMPO} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Línea de software" className={CAMPO} />
        </div>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear línea</BotonEnvio>
    </form>
  )
}

export function FormularioUbicacion({
  cursos,
  areas,
  lineas,
}: {
  cursos: Opcion[]
  areas: Opcion[]
  lineas: Opcion[]
}) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(ubicarCurso, {})

  if (cursos.length === 0) return <Sin que="una asignatura" />
  if (areas.length === 0 && lineas.length === 0) return <Sin que="un área o una línea" />

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Asignatura</label>
        <select name="curso_id" className={CAMPO}>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Área</label>
          <select name="area_id" className={CAMPO} defaultValue="">
            <option value="">Sin área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.etiqueta}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Línea</label>
          <select name="linea_id" className={CAMPO} defaultValue="">
            <option value="">Sin línea</option>
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>{l.etiqueta}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Semestre</label>
          <input name="semestre" type="number" min="1" max="12" className={CAMPO} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Créditos</label>
          <input name="creditos" type="number" step="any" min="0" className={CAMPO} />
        </div>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Guardando…">Ubicar en el plan</BotonEnvio>
    </form>
  )
}

// ---------- MICRO ----------

export function FormularioMicro({
  cursos,
  fichas,
}: {
  cursos: Opcion[]
  fichas: FichaMicro[]
}) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(guardarMicro, {})
  const [cursoId, setCursoId] = useState(cursos[0]?.id ?? 0)

  if (cursos.length === 0) return <Sin que="una asignatura" />

  const ficha = fichas.find((f) => f.cursoId === cursoId)

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Asignatura</label>
        <select
          name="curso_id"
          value={cursoId}
          onChange={(e) => setCursoId(Number(e.target.value))}
          className={CAMPO}
        >
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
        </select>
      </div>

      <div key={cursoId} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Descripción</label>
          <textarea
            name="descripcion"
            rows={3}
            className={CAMPO}
            defaultValue={ficha?.descripcion ?? ''}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Estrategias pedagógicas y didácticas
          </label>
          <textarea
            name="metodologia"
            rows={3}
            className={CAMPO}
            defaultValue={ficha?.metodologia ?? ''}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Estrategias de evaluación
          </label>
          <textarea
            name="evaluacion"
            rows={3}
            className={CAMPO}
            defaultValue={ficha?.evaluacion ?? ''}
          />
        </div>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Guardando…">Guardar ficha</BotonEnvio>
    </form>
  )
}

export function FormularioUnidad({ cursos }: { cursos: Opcion[] }) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(crearUnidad, {})

  if (cursos.length === 0) return <Sin que="una asignatura" />

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Asignatura</label>
        <select name="curso_id" className={CAMPO}>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required placeholder="Estructuras de control" className={CAMPO} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Código <span className="font-normal text-texto-secundario">(auto)</span>
          </label>
          <input name="codigo" placeholder="se genera" className={`${CAMPO} uppercase`} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Semana inicial</label>
          <input name="semana_inicio" type="number" min="1" className={CAMPO} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Semana final</label>
          <input name="semana_fin" type="number" min="1" className={CAMPO} />
        </div>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear unidad</BotonEnvio>
    </form>
  )
}

// ---------- RESULTADOS DE APRENDIZAJE ----------

export function FormularioResultado({
  programas,
  areas,
  cursos,
  competencias,
}: {
  programas: Opcion[]
  areas: Opcion[]
  cursos: Opcion[]
  competencias: Opcion[]
}) {
  const [estado, accion] = useActionState<EstadoCurriculo, FormData>(crearResultado, {})
  const [ambito, setAmbito] = useState('Curso')

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Nivel</label>
        <select
          name="ambito"
          value={ambito}
          onChange={(e) => setAmbito(e.target.value)}
          className={CAMPO}
        >
          <option value="Programa">Del programa</option>
          <option value="Area">Del área de formación</option>
          <option value="Curso">De la asignatura</option>
        </select>
      </div>

      {ambito === 'Programa' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Programa</label>
          <select name="programa_id" className={CAMPO}>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>{p.etiqueta}</option>
            ))}
          </select>
        </div>
      )}

      {ambito === 'Area' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Área</label>
          {areas.length === 0 ? (
            <p className="mt-1.5 text-sm text-texto-secundario">
              Primero hay que crear un área de formación.
            </p>
          ) : (
            <select name="area_id" className={CAMPO}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.etiqueta}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {ambito === 'Curso' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Asignatura</label>
          <select name="curso_id" className={CAMPO}>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.etiqueta}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">Código</label>
          <input name="codigo" required placeholder="RA01" className={`${CAMPO} uppercase`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Competencia asociada{' '}
            <span className="font-normal text-texto-secundario">(opcional)</span>
          </label>
          <select name="competencia_id" className={CAMPO} defaultValue="">
            <option value="">Sin asociar</option>
            {competencias.map((c) => (
              <option key={c.id} value={c.id}>{c.etiqueta}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Enunciado</label>
        <textarea
          name="enunciado"
          required
          rows={3}
          placeholder="Al finalizar, el estudiante será capaz de diseñar algoritmos que resuelvan…"
          className={CAMPO}
        />
        <p className="mt-1 text-xs text-texto-secundario">
          Debe decir qué será capaz de hacer el estudiante, no qué contenidos
          se verán.
        </p>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear resultado de aprendizaje</BotonEnvio>
    </form>
  )
}
