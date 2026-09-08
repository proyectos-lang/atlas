'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

/** Selector de estudiante; el estado va en la URL como el resto de filtros. */
export function SelectorEstudiante({
  opciones,
  seleccionado,
}: {
  opciones: { valor: string; etiqueta: string }[]
  seleccionado: string
}) {
  const router = useRouter()
  const ruta = usePathname()
  const params = useSearchParams()
  const [pendiente, iniciar] = useTransition()

  function cambiar(valor: string) {
    const p = new URLSearchParams(params.toString())
    if (valor) p.set('estudiante', valor)
    else p.delete('estudiante')
    iniciar(() => router.push(`${ruta}?${p.toString()}`, { scroll: false }))
  }

  return (
    <div className={`flex items-center gap-2 ${pendiente ? 'opacity-60' : ''}`}>
      <label htmlFor="sel-estudiante" className="text-xs text-texto-secundario">
        Estudiante
      </label>
      <select
        id="sel-estudiante"
        value={seleccionado}
        onChange={(e) => cambiar(e.target.value)}
        className="rounded-md border border-superficie-borde px-2 py-1 text-xs
                   outline-none focus:border-institucional focus:ring-1 focus:ring-institucional"
      >
        <option value="">Promedio del curso</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
        ))}
      </select>
    </div>
  )
}
