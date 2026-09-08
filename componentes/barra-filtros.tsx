'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import type { Filtro } from '@/lib/kpi/filtros'

/** Nombre del parámetro en la URL para cada filtro. */
const PARAM: Record<string, string> = {
  universidad: 'universidad',
  programa: 'programa',
  curso: 'curso',
  competencia: 'competencia',
  ilo: 'ilo',
  tipoActividad: 'actividad',
  semana: 'semana',
}

/** Al cambiar un filtro se limpian los que dependen de él. */
const DEPENDIENTES: Record<string, string[]> = {
  universidad: ['programa', 'curso'],
  programa: ['curso'],
}

export function BarraFiltros({ controles }: { controles: Filtro[] }) {
  const router = useRouter()
  const ruta = usePathname()
  const params = useSearchParams()
  const [pendiente, iniciar] = useTransition()

  function cambiar(clave: string, valor: string) {
    const p = new URLSearchParams(params.toString())
    const nombre = PARAM[clave] ?? clave

    if (valor) p.set(nombre, valor)
    else p.delete(nombre)

    for (const dep of DEPENDIENTES[clave] ?? []) {
      p.delete(PARAM[dep] ?? dep)
    }

    iniciar(() => router.push(`${ruta}?${p.toString()}`, { scroll: false }))
  }

  const hayFiltros = [...params.keys()].some((k) => Object.values(PARAM).includes(k))

  return (
    <div className={pendiente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">
        Filtros
      </p>

      <div className="space-y-2.5">
        {controles.map((f) => (
          <div key={f.clave}>
            <label
              htmlFor={`filtro-${f.clave}`}
              className="mb-1 block px-1 text-[11px] text-white/70"
            >
              {f.etiqueta}
              {f.fijo && <span className="ml-1 text-white/40">· fijo</span>}
            </label>
            <select
              id={`filtro-${f.clave}`}
              value={f.seleccionado}
              disabled={f.fijo}
              onChange={(e) => cambiar(f.clave, e.target.value)}
              className="w-full rounded-md border border-white/20 bg-white/10 px-2 py-1.5
                         text-xs text-white outline-none transition
                         focus:border-white/50 focus:bg-white/15
                         disabled:cursor-not-allowed disabled:opacity-70
                         [&>option]:bg-institucional [&>option]:text-white"
            >
              {f.opciones.map((o) => (
                <option key={o.valor || 'todas'} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {hayFiltros && (
        <button
          type="button"
          onClick={() => iniciar(() => router.push(ruta, { scroll: false }))}
          className="mt-3 w-full rounded-md border border-white/25 px-2 py-1.5 text-xs
                     text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
