'use client'

import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { useActionState, useState } from 'react'
import { crearPerfil, type EstadoPerfil } from './acciones'

interface Opcion { id: number; etiqueta: string }

export function FormularioPerfil({
  universidades,
  cursos,
  estudiantes,
}: {
  universidades: Opcion[]
  cursos: Opcion[]
  estudiantes: Opcion[]
}) {
  const [estado, accion] = useActionState<EstadoPerfil, FormData>(crearPerfil, {})
  const [rol, setRol] = useState('docente')

  // El alcance exigido cambia con el rol; se muestra solo lo pertinente.
  const pideUniversidad = rol === 'coordinador' || rol === 'asesor'
  const pideCurso = rol === 'docente'
  const pideEstudiante = rol === 'estudiante'

  const campo =
    'mt-1 w-full rounded-md border border-superficie-borde px-3 py-2 text-sm ' +
    'outline-none focus:border-institucional focus:ring-1 focus:ring-institucional'

  return (
    <form action={accion} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre</label>
          <input name="nombre" required className={campo} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Correo</label>
          <input name="email" type="email" required className={campo} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Contraseña inicial
          </label>
          <input
            name="password" type="text" required minLength={8}
            className={campo} placeholder="mínimo 8 caracteres"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Rol</label>
          <select
            name="rol" value={rol} onChange={(e) => setRol(e.target.value)}
            className={campo}
          >
            <option value="admin">Administrador institucional</option>
            <option value="coordinador">Coordinador académico</option>
            <option value="asesor">Asesor pedagógico</option>
            <option value="docente">Docente</option>
            <option value="estudiante">Estudiante</option>
          </select>
        </div>
      </div>

      {rol === 'admin' && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-texto-secundario">
          El administrador ve todas las universidades, cursos y estudiantes.
        </p>
      )}

      {pideUniversidad && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Universidad <span className="text-red-600">*</span>
          </label>
          <select name="universidad_id" required className={campo}>
            <option value="">Selecciona…</option>
            {universidades.map((u) => (
              <option key={u.id} value={u.id}>{u.etiqueta}</option>
            ))}
          </select>
        </div>
      )}

      {pideCurso && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Curso <span className="text-red-600">*</span>
          </label>
          <select name="curso_id" required className={campo}>
            <option value="">Selecciona…</option>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.etiqueta}</option>
            ))}
          </select>
        </div>
      )}

      {pideEstudiante && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Estudiante <span className="text-red-600">*</span>
          </label>
          <select name="usuario_id" required className={campo}>
            <option value="">Selecciona…</option>
            {estudiantes.map((e) => (
              <option key={e.id} value={e.id}>{e.etiqueta}</option>
            ))}
          </select>
        </div>
      )}

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

      <BotonEnvio enProgreso="Creando…">Crear perfil</BotonEnvio>
    </form>
  )
}
