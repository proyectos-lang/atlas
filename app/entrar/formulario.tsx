'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { entrar, type EstadoEntrada } from './acciones'

export function FormularioEntrada() {
  const [estado, accion] = useActionState<EstadoEntrada, FormData>(entrar, {})
  const siguiente = useSearchParams().get('siguiente') ?? ''

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
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
          className="mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2.5 text-sm
                     outline-none transition focus:border-institucional focus:ring-2 focus:ring-institucional/20"
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
          className="mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2.5 text-sm
                     outline-none transition focus:border-institucional focus:ring-2 focus:ring-institucional/20"
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

      <BotonEnvio enProgreso="Entrando…" tamano="lg" className="mt-2 w-full">
        Entrar
      </BotonEnvio>
    </form>
  )
}
