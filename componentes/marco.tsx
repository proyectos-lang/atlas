import Link from 'next/link'
import { salir } from '@/app/entrar/acciones'
import { type Perfil } from '@/lib/auth/alcance'
import { navegacionDe } from '@/lib/auth/navegacion'
import { NavLateral } from './nav-lateral'

const NOMBRE_ROL: Record<string, string> = {
  admin: 'Administrador institucional',
  coordinador: 'Coordinador académico',
  asesor: 'Asesor pedagógico',
  docente: 'Docente',
  estudiante: 'Estudiante',
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
  const grupos = navegacionDe(perfil.rol)

  const navegacion = (
    <>
      <NavLateral grupos={grupos} />
      {lateral}
    </>
  )

  return (
    <div className="min-h-screen bg-superficie-pagina">
      {/* Cabecera fija: si sube con el scroll, la barra lateral —que es
          sticky a 89 px— queda flotando y aparece una franja del fondo
          entre ambas. Fijando la cabecera el marco se mantiene unido. */}
      <header className="sticky top-0 z-40 flex h-banda items-center justify-between gap-3 bg-institucional px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <label
            htmlFor="abrir-menu"
            className="cursor-pointer rounded-lg border border-white/25 p-2 text-white
                       transition hover:bg-white/10 lg:hidden"
            aria-label="Abrir menú"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </label>

          {/* Marca y título: la marca no cambia, el título sí. Separarlos
              evita el "ATLAS - " repetido en cada pestaña del navegador. */}
          <Link href="/inicio" className="flex shrink-0 items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15
                         text-sm font-bold tracking-tight text-white"
              aria-hidden
            >
              A
            </span>
            <span className="hidden text-lg font-semibold tracking-tight text-white sm:block">
              ATLAS
            </span>
          </Link>

          <span className="hidden h-6 w-px bg-white/20 lg:block" aria-hidden />

          <h1 className="truncate text-base font-medium text-white/90 lg:text-lg">
            {titulo}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <span className="block text-sm font-medium leading-tight text-white">
              {perfil.nombre}
            </span>
            <span className="block text-[11px] leading-tight text-white/60">
              {NOMBRE_ROL[perfil.rol] ?? perfil.rol}
            </span>
          </div>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                       bg-white/15 text-sm font-semibold text-white"
            aria-hidden
          >
            {perfil.nombre.trim().charAt(0).toUpperCase()}
          </span>
          <form action={salir}>
            <button
              type="submit"
              className="rounded-lg border border-white/25 px-3 py-1.5 text-sm text-white
                         transition hover:bg-white/10"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <div className="flex">
        {/* El checkbox abre el panel sin estado en cliente. Debe ser HERMANO
            del velo y del <aside>: `peer-checked:` sólo alcanza a hermanos
            posteriores, y estando fuera de este contenedor no se aplicaba
            y el panel móvil nunca llegaba a abrirse. */}
        <input type="checkbox" id="abrir-menu" className="peer sr-only" />

        {/* Velo: cierra el panel al tocar fuera. */}
        <label
          htmlFor="abrir-menu"
          className="fixed inset-0 z-20 hidden bg-black/40 peer-checked:block lg:peer-checked:hidden"
          aria-hidden
        />

        {/* Alto exacto del hueco bajo la cabecera; el contenido que no
            quepa (los siete filtros) se desplaza dentro del propio panel. */}
        <aside
          className="fixed left-0 top-banda z-30 h-[calc(100dvh-89px)] w-lateral shrink-0
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
