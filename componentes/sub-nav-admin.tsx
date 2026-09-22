'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Sub-navegación del área de configuración, inyectada en el slot `lateral`
 * del Marco (debajo de la navegación por rol).
 *
 * Es cliente sólo por `usePathname()`: necesita saber qué sección está
 * abierta para marcarla. El resto del árbol sigue siendo servidor.
 */

const SECCIONES: readonly { ruta: string; etiqueta: string; pie: string }[] = [
  {
    ruta: '/admin/perfiles',
    etiqueta: 'Perfiles de acceso',
    pie: 'Quién entra y qué alcance tiene',
  },
  {
    ruta: '/admin/jerarquia',
    etiqueta: 'Jerarquía académica',
    pie: 'Programas, cursos y grupos',
  },
  {
    ruta: '/admin/competencias',
    etiqueta: 'Competencias e indicadores',
    pie: 'Dimensiones y cómo se miden',
  },
  {
    ruta: '/admin/fuentes',
    etiqueta: 'Fuentes de datos',
    pie: 'De dónde vienen las evidencias',
  },
  {
    ruta: '/admin/perfil-egreso',
    etiqueta: 'Perfil de egreso',
    pie: 'Contexto curricular para el análisis de IA',
  },
]

export function SubNavAdmin() {
  const ruta = usePathname()

  return (
    <div className="border-t border-white/15 pt-4">
      <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-white/55">
        Configuración
      </h2>
      <nav className="space-y-1">
        {SECCIONES.map((s) => {
          const activa = ruta === s.ruta || ruta.startsWith(`${s.ruta}/`)
          return (
            <Link
              key={s.ruta}
              href={s.ruta}
              aria-current={activa ? 'page' : undefined}
              className={
                activa
                  ? 'block rounded-md bg-white/15 px-3 py-2 text-sm font-medium text-white'
                  : 'block rounded-md px-3 py-2 text-sm text-white/85 transition hover:bg-white/10 hover:text-white'
              }
            >
              {s.etiqueta}
              <span className="mt-0.5 block text-xs font-normal text-white/55">
                {s.pie}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
