'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, GraduationCap, LayoutGrid, BookOpen, User, BarChart3,
  Sparkles, ClipboardCheck, Settings, HelpCircle, Shapes,
} from 'lucide-react'
import type { GrupoNav, IconoNav } from '@/lib/auth/navegacion'

/**
 * Navegación lateral agrupada por tipo de tarea.
 *
 * Cliente sólo por `usePathname()`: hace falta para marcar dónde está el
 * usuario. Los grupos llegan ya filtrados por rol desde el servidor.
 */

const ICONOS: Record<IconoNav, typeof Building2> = {
  institucion: Building2,
  programa: GraduationCap,
  aula: BookOpen,
  persona: User,
  tablero: LayoutGrid,
  analisis: BarChart3,
  ia: Sparkles,
  revision: ClipboardCheck,
  ajustes: Settings,
  galeria: Shapes,
  ayuda: HelpCircle,
}

export function NavLateral({ grupos }: { grupos: GrupoNav[] }) {
  const ruta = usePathname()

  // `/admin` cubre `/admin/perfiles`; `/docente` NO debe encenderse dentro de
  // `/docente/revision`, que es su propio ítem. Se compara con la ruta más
  // larga que coincida, así sólo se marca una.
  const rutas = grupos.flatMap((g) => g.items.map((i) => i.ruta))
  const activa = rutas
    .filter((r) => ruta === r || ruta.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length)[0]

  return (
    <nav className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">
            {g.titulo}
          </h2>
          <div className="space-y-0.5">
            {g.items.map((i) => {
              const Icono = ICONOS[i.icono]
              const esActiva = i.ruta === activa

              return (
                <Link
                  key={i.ruta}
                  href={i.ruta}
                  aria-current={esActiva ? 'page' : undefined}
                  className={[
                    'group relative flex items-start gap-2.5 rounded-lg px-3 py-2 transition',
                    esActiva
                      ? 'bg-white/15 text-white'
                      : 'text-white/80 hover:bg-white/10 hover:text-white',
                  ].join(' ')}
                >
                  {/* Barra de posición: refuerza el estado activo sin depender
                      sólo del fondo, que en azul sobre azul se lee poco. */}
                  {esActiva && (
                    <span
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-white"
                      aria-hidden
                    />
                  )}
                  <Icono
                    size={16}
                    className={esActiva ? 'mt-0.5 shrink-0' : 'mt-0.5 shrink-0 opacity-70'}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium leading-tight">
                      {i.etiqueta}
                    </span>
                    {i.pie && (
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-white/50">
                        {i.pie}
                      </span>
                    )}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
