import Link from 'next/link'
import { salir } from '@/app/entrar/acciones'
import { RUTAS_POR_ROL, type Perfil } from '@/lib/auth/alcance'

const ETIQUETA: Record<string, string> = {
  '/administrador': 'Administrador Institucional',
  '/coordinador': 'Coordinador Académico',
  '/asesor': 'Asesor Pedagógico',
  '/docente': 'Docente',
  '/estudiante': 'Estudiante',
  '/analisis': 'Análisis',
  '/admin': 'Administración',
  '/componentes': 'Galería de componentes',
  '/recomendador': 'Recomendaciones de IA',
}

/**
 * Marco común: banda superior azul institucional de 89 px y barra lateral
 * de 218 px, como en el informe original.
 *
 * Bajo 1024 px la barra lateral se convierte en un panel deslizable que se
 * abre con el botón de menú. Sin esto, los 218 px fijos empujaban el
 * contenido fuera de la pantalla en móvil.
 */
export function Marco({
  perfil,
  titulo,
  lateral,
  children,
}: {
  perfil: Perfil
  titulo: string
  lateral?: React.ReactNode
  children: React.ReactNode
}) {
  const rutas = RUTAS_POR_ROL[perfil.rol]

  const navegacion = (
    <>
      <nav className="mb-6 space-y-1">
        {rutas.map((r) => (
          <Link
            key={r}
            href={r}
            className="block rounded-md px-3 py-2 text-sm text-white/85 transition
                       hover:bg-white/10 hover:text-white"
          >
            {ETIQUETA[r] ?? r}
          </Link>
        ))}
      </nav>
      {lateral}
    </>
  )

  return (
    <div className="min-h-screen bg-superficie-pagina">
      {/* El checkbox controla el panel sin necesidad de estado en cliente. */}
      <input type="checkbox" id="abrir-menu" className="peer sr-only" />

      <header className="flex h-banda items-center justify-between gap-3 bg-institucional px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <label
            htmlFor="abrir-menu"
            className="cursor-pointer rounded-md border border-white/30 p-2 text-white lg:hidden"
            aria-label="Abrir menú"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </label>
          <h1 className="truncate text-lg font-semibold text-white lg:text-2xl">
            ATLAS - {titulo}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm text-white/80 sm:inline">{perfil.nombre}</span>
          <form action={salir}>
            <button
              type="submit"
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white
                         transition hover:bg-white/10"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="flex">
        {/* Velo: cierra el panel al tocar fuera. */}
        <label
          htmlFor="abrir-menu"
          className="fixed inset-0 z-20 hidden bg-black/40 peer-checked:block lg:peer-checked:hidden"
          aria-hidden
        />

        <aside
          className="fixed left-0 top-banda z-30 h-[calc(100vh-89px)] w-lateral shrink-0
                     -translate-x-full overflow-y-auto bg-institucional px-3 py-4
                     transition-transform peer-checked:translate-x-0
                     lg:sticky lg:translate-x-0"
        >
          {navegacion}
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
