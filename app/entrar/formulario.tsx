'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrar, type EstadoEntrada } from './acciones'

function Boton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 w-full rounded-md bg-institucional px-4 py-2.5 text-sm font-medium text-white
                 transition hover:bg-institucional-claro disabled:opacity-60"
    >
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  )
}

export function FormularioEntrada() {
  const [estado, accion] = useActionState<EstadoEntrada, FormData>(entrar, {})

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Correo institucional
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-superficie-borde px-3 py-2 text-sm
                     outline-none focus:border-institucional focus:ring-1 focus:ring-institucional"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-superficie-borde px-3 py-2 text-sm
                     outline-none focus:border-institucional focus:ring-1 focus:ring-institucional"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {estado.error}
        </p>
      )}

      <Boton />
    </form>
  )
}
