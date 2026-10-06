'use client'

import { useActionState, useState } from 'react'
import { Pencil } from 'lucide-react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { editarPerfil, type EstadoPerfil } from './acciones'

/**
 * Lápiz de cada perfil: edita cuenta, rol, ámbito y grupos del docente.
 *
 * Muestra sólo los campos del rol elegido, igual que el alta: cambiar el
 * rol en el desplegable cambia lo que se pide.
 */

export interface OpcionPerfil { id: number; etiqueta: string; cursoId?: number }

export interface ValoresPerfil {
  id: number
  nombre: string
  email: string
  rol: string
  universidadId: number | null
  programaId: number | null
  cursoId: number | null
  usuarioId: number | null
  /** Grupos de los que es responsable, más el grupo fijo antiguo si lo tenía. */
  grupos: number[]
}

const CAMPO =
  'mt-1 w-full rounded-md border border-superficie-borde bg-white px-2.5 py-1.5 ' +
  'text-sm outline-none transition focus:border-institucional ' +
  'focus:ring-2 focus:ring-institucional/20'

export function EditorPerfil({
  valores, universidades, programas, cursos, grupos, estudiantes, esUnoMismo,
}: {
  valores: ValoresPerfil
  universidades: OpcionPerfil[]
  programas: OpcionPerfil[]
  cursos: OpcionPerfil[]
  grupos: OpcionPerfil[]
  estudiantes: OpcionPerfil[]
  esUnoMismo: boolean
}) {
  const [estado, accion] = useActionState<EstadoPerfil, FormData>(editarPerfil, {})
  const [rol, setRol] = useState(valores.rol)

  const ambitoUniversidad = rol === 'coordinador' || rol === 'asesor'

  return (
    <details className="mt-1">
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1 text-xs
                   text-institucional underline underline-offset-2"
        title={`Editar ${valores.nombre}`}
      >
        <Pencil size={12} aria-hidden />
        Editar
      </summary>

      <form action={accion} className="mt-2 space-y-3 rounded-md border border-superficie-borde bg-white p-3">
        <input type="hidden" name="id" value={String(valores.id)} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">Nombre</label>
            <input name="nombre" required defaultValue={valores.nombre} className={CAMPO} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Correo (con el que entra)</label>
            <input name="email" type="email" required defaultValue={valores.email} className={CAMPO} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Contraseña nueva <span className="font-normal text-texto-secundario">(vacía = no cambiar)</span>
            </label>
            <input name="password" type="text" minLength={8} autoComplete="new-password" className={CAMPO} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Rol</label>
            <select
              name="rol"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              disabled={esUnoMismo}
              className={CAMPO}
            >
              <option value="admin">Administrador institucional</option>
              <option value="coordinador">Coordinador académico</option>
              <option value="asesor">Asesor pedagógico</option>
              <option value="docente">Docente</option>
              <option value="estudiante">Estudiante</option>
            </select>
            {/* Un select deshabilitado no se envía: se manda aparte. */}
            {esUnoMismo && <input type="hidden" name="rol" value={rol} />}
            {esUnoMismo && (
              <p className="mt-1 text-[11px] text-texto-secundario">
                No puedes cambiar tu propio rol.
              </p>
            )}
          </div>
        </div>

        {ambitoUniversidad && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Universidad</label>
              <select name="universidad_id" defaultValue={valores.universidadId ?? ''} className={CAMPO}>
                <option value="">Selecciona…</option>
                {universidades.map((u) => <option key={u.id} value={u.id}>{u.etiqueta}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Programa (opcional)</label>
              <select name="programa_id" defaultValue={valores.programaId ?? ''} className={CAMPO}>
                <option value="">Toda la universidad</option>
                {programas.map((p) => <option key={p.id} value={p.id}>{p.etiqueta}</option>)}
              </select>
            </div>
          </div>
        )}

        {rol === 'docente' && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-700">Grupos a su cargo</label>
              {grupos.length === 0 ? (
                <p className="mt-1 text-xs text-texto-secundario">Todavía no hay grupos creados.</p>
              ) : (
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-superficie-borde p-2">
                  {grupos.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox" name="grupos" value={g.id}
                        defaultChecked={valores.grupos.includes(g.id)}
                        className="h-4 w-4 accent-institucional"
                      />
                      {g.etiqueta}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] text-texto-secundario">
                Ve los estudiantes de los grupos marcados. Un grupo marcado aquí
                deja de estar a cargo de su docente anterior.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Curso completo (opcional)</label>
              <select name="curso_id" defaultValue={valores.cursoId ?? ''} className={CAMPO}>
                <option value="">Ninguno</option>
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
              </select>
            </div>
          </>
        )}

        {rol === 'estudiante' && (
          <div>
            <label className="block text-xs font-medium text-slate-700">Registro de estudiante</label>
            <select name="usuario_id" defaultValue={valores.usuarioId ?? ''} className={CAMPO}>
              <option value="">Selecciona…</option>
              {estudiantes.map((e) => <option key={e.id} value={e.id}>{e.etiqueta}</option>)}
            </select>
          </div>
        )}

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
