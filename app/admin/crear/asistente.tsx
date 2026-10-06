'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Building2, GraduationCap, BookOpen, Users, Target, ArrowLeft, Check,
} from 'lucide-react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { BotonEnlace } from '@/componentes/ui/boton'
import { SelectorDocente } from '@/componentes/selector-docente'
import { crearUniversidad, crearCurso, type EstadoCreacion } from './acciones'
import { crearPrograma, crearGrupo } from '@/app/admin/jerarquia/acciones'
import { crearResultado } from '@/app/admin/curriculo/acciones'

/**
 * Asistente de creación.
 *
 * Primero pregunta qué se quiere crear; después guía paso a paso: elegir
 * dónde va (la universidad, el programa, el curso), rellenar sus datos, y
 * al terminar proponer lo que naturalmente sigue —una universidad recién
 * creada pide un programa; un programa, un curso—.
 *
 * Lo recién creado se añade a las listas locales de inmediato: el paso
 * siguiente puede seleccionarlo sin esperar a que la página se recargue.
 */

export interface Opcion { id: number; etiqueta: string }
export interface OpcionPrograma extends Opcion { universidadId: number }
export interface OpcionCurso extends Opcion { programaId: number | null }

type Tipo = 'universidad' | 'programa' | 'curso' | 'grupo' | 'resultado'

interface Creado { tipo: Tipo; id: number; nombre: string; mensaje?: string }

const TIPOS: { tipo: Tipo; titulo: string; pie: string; icono: typeof Building2 }[] = [
  { tipo: 'universidad', titulo: 'Universidad', pie: 'La institución que ofrece programas', icono: Building2 },
  { tipo: 'programa', titulo: 'Programa', pie: 'Una carrera dentro de una universidad', icono: GraduationCap },
  { tipo: 'curso', titulo: 'Curso o asignatura', pie: 'Una materia dentro de un programa', icono: BookOpen },
  { tipo: 'grupo', titulo: 'Grupo', pie: 'Una sección de un curso, con su docente', icono: Users },
  { tipo: 'resultado', titulo: 'Resultado de aprendizaje', pie: 'Lo que el estudiante será capaz de hacer', icono: Target },
]

const PASOS: Record<Tipo, string[]> = {
  universidad: ['Datos', 'Listo'],
  programa: ['Universidad', 'Datos', 'Listo'],
  curso: ['Programa', 'Datos', 'Listo'],
  grupo: ['Curso', 'Datos', 'Listo'],
  resultado: ['Dónde', 'Datos', 'Listo'],
}

const CAMPO =
  'mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2 text-sm ' +
  'outline-none transition focus:border-institucional focus:ring-2 ' +
  'focus:ring-institucional/20'

export function Asistente({
  universidades,
  programas,
  cursos,
  competencias,
  docentes,
  puedeCrearUniversidad,
}: {
  universidades: Opcion[]
  programas: OpcionPrograma[]
  cursos: OpcionCurso[]
  competencias: Opcion[]
  docentes: Opcion[]
  puedeCrearUniversidad: boolean
}) {
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const [paso, setPaso] = useState(0)
  const [creado, setCreado] = useState<Creado | null>(null)

  // Contexto elegido en los pasos previos.
  const [universidadId, setUniversidadId] = useState<number | null>(null)
  const [programaId, setProgramaId] = useState<number | null>(null)
  const [cursoId, setCursoId] = useState<number | null>(null)

  // Listas locales: reciben lo recién creado para poder encadenar.
  const [univs, setUnivs] = useState(universidades)
  const [progs, setProgs] = useState(programas)
  const [curs, setCurs] = useState(cursos)

  const empezar = (t: Tipo, contexto: Partial<{ u: number; p: number; c: number }> = {}) => {
    setTipo(t)
    setCreado(null)
    setUniversidadId(contexto.u ?? null)
    setProgramaId(contexto.p ?? null)
    setCursoId(contexto.c ?? null)
    // Si el contexto ya viene dado, se salta el paso de elegirlo.
    const saltar =
      (t === 'programa' && contexto.u) ||
      (t === 'curso' && contexto.p) ||
      (t === 'grupo' && contexto.c)
    setPaso(saltar ? 1 : 0)
  }

  const reiniciar = () => {
    setTipo(null); setPaso(0); setCreado(null)
    setUniversidadId(null); setProgramaId(null); setCursoId(null)
  }

  const alCrear = (c: Creado) => {
    setCreado(c)
    if (c.tipo === 'universidad') setUnivs((v) => [...v, { id: c.id, etiqueta: c.nombre }])
    if (c.tipo === 'programa' && universidadId !== null) {
      setProgs((v) => [...v, { id: c.id, etiqueta: c.nombre, universidadId }])
    }
    if (c.tipo === 'curso') setCurs((v) => [...v, { id: c.id, etiqueta: c.nombre, programaId }])
    setPaso(PASOS[c.tipo].length - 1)
  }

  // ---------- Paso 0: qué crear ----------
  if (tipo === null) {
    return (
      <section className="rounded-tarjeta border border-superficie-borde bg-white p-6">
        <h2 className="text-lg font-semibold text-institucional">¿Qué deseas crear?</h2>
        <p className="mt-1 text-sm text-texto-secundario">
          Elige una opción y te guío paso a paso.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TIPOS.filter((t) => t.tipo !== 'universidad' || puedeCrearUniversidad).map((t) => (
            <button
              key={t.tipo}
              type="button"
              onClick={() => empezar(t.tipo)}
              className="group flex items-start gap-3 rounded-lg border border-superficie-borde
                         p-4 text-left transition hover:border-institucional/40
                         hover:bg-institucional-suave"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                           bg-institucional-suave text-institucional
                           group-hover:bg-institucional group-hover:text-white"
                aria-hidden
              >
                <t.icono size={19} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{t.titulo}</span>
                <span className="mt-0.5 block text-xs text-texto-secundario">{t.pie}</span>
              </span>
            </button>
          ))}
        </div>

        {!puedeCrearUniversidad && (
          <p className="mt-4 text-xs text-texto-secundario">
            Crear universidades es tarea del administrador.
          </p>
        )}
      </section>
    )
  }

  const pasos = PASOS[tipo]
  const titulo = TIPOS.find((t) => t.tipo === tipo)!.titulo

  return (
    <section className="rounded-tarjeta border border-superficie-borde bg-white p-6">
      {/* ---------- Cabecera con progreso ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={reiniciar}
            className="inline-flex items-center gap-1 text-xs text-texto-secundario
                       hover:text-institucional"
          >
            <ArrowLeft size={13} aria-hidden /> Crear otra cosa
          </button>
          <h2 className="mt-1 text-lg font-semibold text-institucional">Nuevo: {titulo}</h2>
        </div>

        <ol className="flex items-center gap-2 text-xs">
          {pasos.map((nombre, i) => (
            <li key={nombre} className="flex items-center gap-2">
              <span
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                  i < paso ? 'bg-green-600 text-white'
                    : i === paso ? 'bg-institucional text-white'
                    : 'bg-slate-200 text-slate-600',
                ].join(' ')}
                aria-hidden
              >
                {i < paso ? <Check size={12} /> : i + 1}
              </span>
              <span className={i === paso ? 'font-medium text-slate-900' : 'text-texto-secundario'}>
                {nombre}
              </span>
              {i < pasos.length - 1 && <span className="h-px w-5 bg-superficie-borde" aria-hidden />}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6">
        {/* ---------- Paso de contexto ---------- */}
        {paso === 0 && tipo !== 'universidad' && (
          <PasoContexto
            tipo={tipo}
            universidades={univs}
            programas={progs}
            cursos={curs}
            universidadId={universidadId}
            programaId={programaId}
            cursoId={cursoId}
            onUniversidad={setUniversidadId}
            onPrograma={setProgramaId}
            onCurso={setCursoId}
            onSiguiente={() => setPaso(1)}
          />
        )}

        {/* ---------- Paso de datos ---------- */}
        {((paso === 0 && tipo === 'universidad') || (paso === 1 && tipo !== 'universidad')) && (
          <PasoDatos
            tipo={tipo}
            universidadId={universidadId}
            programaId={programaId}
            cursoId={cursoId}
            programas={progs}
            cursos={curs}
            competencias={competencias}
            docentes={docentes}
            nombreContexto={
              tipo === 'programa' ? univs.find((u) => u.id === universidadId)?.etiqueta
              : tipo === 'curso' ? progs.find((p) => p.id === programaId)?.etiqueta
              : tipo === 'grupo' ? curs.find((c) => c.id === cursoId)?.etiqueta
              : undefined
            }
            onAtras={tipo === 'universidad' ? reiniciar : () => setPaso(0)}
            onCreado={alCrear}
          />
        )}

        {/* ---------- Paso final ---------- */}
        {creado && paso === pasos.length - 1 && (
          <PasoListo
            creado={creado}
            universidadId={universidadId}
            programaId={programaId}
            onEncadenar={empezar}
            onReiniciar={reiniciar}
          />
        )}
      </div>
    </section>
  )
}

// ============================================================
// Paso: elegir dónde va
// ============================================================

function PasoContexto({
  tipo, universidades, programas, cursos,
  universidadId, programaId, cursoId,
  onUniversidad, onPrograma, onCurso, onSiguiente,
}: {
  tipo: Tipo
  universidades: Opcion[]
  programas: OpcionPrograma[]
  cursos: OpcionCurso[]
  universidadId: number | null
  programaId: number | null
  cursoId: number | null
  onUniversidad: (id: number | null) => void
  onPrograma: (id: number | null) => void
  onCurso: (id: number | null) => void
  onSiguiente: () => void
}) {
  // Cada nivel se filtra por el anterior, para que no se pueda elegir un
  // curso de otro programa por descuido.
  const progsVisibles = universidadId === null
    ? programas
    : programas.filter((p) => p.universidadId === universidadId)
  const cursosVisibles = programaId === null
    ? cursos
    : cursos.filter((c) => c.programaId === programaId)

  const listo =
    (tipo === 'programa' && universidadId !== null) ||
    (tipo === 'curso' && programaId !== null) ||
    (tipo === 'grupo' && cursoId !== null) ||
    tipo === 'resultado'

  const Selector = ({
    etiqueta, valor, opciones, onCambio, vacio,
  }: {
    etiqueta: string; valor: number | null; opciones: Opcion[]
    onCambio: (id: number | null) => void; vacio: string
  }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700">{etiqueta}</label>
      {opciones.length === 0 ? (
        <p className="mt-1.5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{vacio}</p>
      ) : (
        <select
          value={valor ?? ''}
          onChange={(e) => onCambio(e.target.value ? Number(e.target.value) : null)}
          className={CAMPO}
        >
          <option value="">Selecciona…</option>
          {opciones.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
        </select>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        {tipo === 'programa' && 'Un programa pertenece a una universidad. ¿A cuál?'}
        {tipo === 'curso' && 'Un curso pertenece a un programa. Elige primero la universidad y luego el programa.'}
        {tipo === 'grupo' && 'Un grupo es una sección de un curso. Llega hasta el curso.'}
        {tipo === 'resultado' && 'El resultado de aprendizaje se define en el paso siguiente, junto con su nivel.'}
      </p>

      {(tipo === 'programa' || tipo === 'curso' || tipo === 'grupo') && (
        <Selector
          etiqueta="Universidad"
          valor={universidadId}
          opciones={universidades}
          onCambio={(id) => { onUniversidad(id); onPrograma(null); onCurso(null) }}
          vacio="Todavía no hay universidades. Crea una primero."
        />
      )}

      {(tipo === 'curso' || tipo === 'grupo') && (
        <Selector
          etiqueta="Programa"
          valor={programaId}
          opciones={progsVisibles}
          onCambio={(id) => { onPrograma(id); onCurso(null) }}
          vacio={universidadId === null
            ? 'Elige antes la universidad.'
            : 'Esta universidad no tiene programas todavía. Crea uno primero.'}
        />
      )}

      {tipo === 'grupo' && (
        <Selector
          etiqueta="Curso"
          valor={cursoId}
          opciones={cursosVisibles}
          onCambio={onCurso}
          vacio={programaId === null
            ? 'Elige antes el programa.'
            : 'Este programa no tiene cursos todavía. Crea uno primero.'}
        />
      )}

      <div className="pt-2">
        <button
          type="button"
          disabled={!listo}
          onClick={onSiguiente}
          className="rounded-lg bg-institucional px-4 py-2 text-sm font-medium text-white
                     transition hover:bg-institucional-claro disabled:cursor-not-allowed
                     disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Paso: los datos
// ============================================================

function PasoDatos({
  tipo, universidadId, programaId, cursoId,
  programas, cursos, competencias, docentes, nombreContexto,
  onAtras, onCreado,
}: {
  tipo: Tipo
  universidadId: number | null
  programaId: number | null
  cursoId: number | null
  programas: OpcionPrograma[]
  cursos: OpcionCurso[]
  competencias: Opcion[]
  docentes: Opcion[]
  nombreContexto?: string
  onAtras: () => void
  onCreado: (c: Creado) => void
}) {
  const accionDe: Record<Tipo, (p: EstadoCreacion, f: FormData) => Promise<EstadoCreacion>> = {
    universidad: crearUniversidad,
    programa: crearPrograma,
    curso: crearCurso,
    grupo: crearGrupo,
    resultado: crearResultado,
  }

  const [estado, accion] = useActionState<EstadoCreacion, FormData>(accionDe[tipo], {})
  const [ambito, setAmbito] = useState<'Programa' | 'Curso'>('Curso')

  // Al confirmarse la creación, el asistente avanza solo.
  useEffect(() => {
    if (estado.ok && estado.id !== undefined) {
      onCreado({ tipo, id: estado.id, nombre: estado.nombre ?? estado.ok, mensaje: estado.ok })
    }
    // onCreado cambia de identidad en cada render del padre; disparar por
    // él repetiría la llamada. Sólo importa el resultado de la acción.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.ok, estado.id])

  return (
    <form action={accion} className="space-y-4">
      {nombreContexto && (
        <p className="rounded-md bg-institucional-suave px-3 py-2 text-sm text-slate-700">
          Se creará en <strong>{nombreContexto}</strong>.
        </p>
      )}

      {/* Contexto oculto, según el tipo */}
      {tipo === 'programa' && <input type="hidden" name="universidad_id" value={universidadId ?? ''} />}
      {tipo === 'curso' && <input type="hidden" name="programa_id" value={programaId ?? ''} />}
      {tipo === 'grupo' && <input type="hidden" name="curso_id" value={cursoId ?? ''} />}

      {tipo === 'resultado' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700">Nivel</label>
            <select
              name="ambito"
              value={ambito}
              onChange={(e) => setAmbito(e.target.value as 'Programa' | 'Curso')}
              className={CAMPO}
            >
              <option value="Curso">De una asignatura</option>
              <option value="Programa">Del programa</option>
            </select>
          </div>
          {ambito === 'Programa' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700">Programa</label>
              <select name="programa_id" required className={CAMPO}>
                <option value="">Selecciona…</option>
                {programas.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700">Asignatura</label>
              <select name="curso_id" required className={CAMPO}>
                <option value="">Selecciona…</option>
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            {tipo === 'resultado' ? 'Código' : 'Nombre'}
          </label>
          <input
            name={tipo === 'resultado' ? 'codigo' : 'nombre'}
            required
            autoFocus
            placeholder={{
              universidad: 'Universidad Nacional',
              programa: 'Ingeniería Industrial',
              curso: 'Programación I',
              grupo: 'Grupo 2',
              resultado: 'RA01',
            }[tipo]}
            className={`${CAMPO}${tipo === 'resultado' ? ' uppercase' : ''}`}
          />
        </div>
        {tipo !== 'resultado' && (
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Código <span className="font-normal text-texto-secundario">(auto)</span>
            </label>
            <input name="codigo" placeholder="se genera" className={CAMPO} />
          </div>
        )}
      </div>

      {tipo === 'resultado' && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700">Enunciado</label>
            <textarea
              name="enunciado"
              required
              rows={3}
              placeholder="Al finalizar, el estudiante será capaz de…"
              className={CAMPO}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Competencia asociada <span className="font-normal text-texto-secundario">(opcional)</span>
            </label>
            <select name="competencia_id" className={CAMPO} defaultValue="">
              <option value="">Sin asociar</option>
              {competencias.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
            </select>
          </div>
        </>
      )}

      {(tipo === 'universidad' || tipo === 'programa') && (
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
      )}

      {tipo === 'curso' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Semanas</label>
            <input name="semanas" type="number" min="1" max="52" defaultValue="6" className={CAMPO} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Periodo <span className="font-normal text-texto-secundario">(opcional)</span>
            </label>
            <input name="periodo" placeholder="2026-1" className={CAMPO} />
          </div>
        </div>
      )}

      {tipo === 'grupo' && (
        <>
          <SelectorDocente docentes={docentes} campo={CAMPO} />
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Periodo <span className="font-normal text-texto-secundario">(opcional)</span>
            </label>
            <input name="periodo" placeholder="2026-1" className={CAMPO} />
          </div>
        </>
      )}

      {estado.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <BotonEnvio enProgreso="Creando…">Crear</BotonEnvio>
        <button
          type="button"
          onClick={onAtras}
          className="text-sm text-texto-secundario underline underline-offset-2"
        >
          Atrás
        </button>
      </div>
    </form>
  )
}

// ============================================================
// Paso: listo, ¿qué sigue?
// ============================================================

function PasoListo({
  creado, universidadId, programaId, onEncadenar, onReiniciar,
}: {
  creado: Creado
  universidadId: number | null
  programaId: number | null
  onEncadenar: (t: Tipo, ctx: Partial<{ u: number; p: number; c: number }>) => void
  onReiniciar: () => void
}) {
  const siguiente: Record<Tipo, { texto: string; accion: () => void } | null> = {
    universidad: { texto: `Crear un programa en ${creado.nombre}`, accion: () => onEncadenar('programa', { u: creado.id }) },
    programa: { texto: `Crear un curso en ${creado.nombre}`, accion: () => onEncadenar('curso', { u: universidadId ?? undefined, p: creado.id }) },
    curso: { texto: `Crear otro grupo en ${creado.nombre}`, accion: () => onEncadenar('grupo', { u: universidadId ?? undefined, p: programaId ?? undefined, c: creado.id }) },
    grupo: null,
    resultado: null,
  }
  const sig = siguiente[creado.tipo]

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg bg-green-50 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white" aria-hidden>
          <Check size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-green-900">Creado correctamente</p>
          <p className="mt-0.5 text-sm text-green-900">{creado.mensaje ?? creado.nombre}</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800">¿Qué sigue?</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {sig && (
            <button
              type="button"
              onClick={sig.accion}
              className="rounded-lg bg-institucional px-4 py-2 text-sm font-medium text-white
                         transition hover:bg-institucional-claro"
            >
              {sig.texto}
            </button>
          )}
          {creado.tipo === 'resultado' && (
            <BotonEnlace href="/admin/curriculo" variante="primario">
              Enlazarlo con sus indicadores
            </BotonEnlace>
          )}
          <button
            type="button"
            onClick={onReiniciar}
            className="rounded-lg border border-superficie-borde px-4 py-2 text-sm
                       font-medium text-institucional transition hover:bg-institucional-suave"
          >
            Crear otra cosa
          </button>
          <Link
            href="/admin/jerarquia"
            className="self-center text-sm text-texto-secundario underline underline-offset-2"
          >
            Ver la jerarquía completa
          </Link>
        </div>
      </div>
    </div>
  )
}
