import { ShieldAlert } from 'lucide-react'
import { perfilActual } from '@/lib/auth/sesion'
import { salir } from '@/app/entrar/acciones'
import { clasesBoton } from '@/componentes/ui/boton'

export const metadata = { title: 'Sin acceso · ATLAS' }

/**
 * Perfil sin ningún módulo asignado.
 *
 * No usa `exigirSesion` ni el Marco: ambos dependen de que el perfil pueda
 * ver algo, y quien llega aquí no puede. Con el Marco, la barra lateral
 * saldría vacía; con `exigirSesion`, el redirect volvería a caer aquí.
 */
export default async function PaginaSinAcceso() {
  const perfil = await perfilActual()

  return (
    <main className="flex min-h-screen items-center justify-center bg-superficie-pagina p-6">
      <div className="w-full max-w-md rounded-tarjeta border border-superficie-borde
                      bg-white p-8 text-center shadow-sm">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full
                     bg-amber-50 text-amber-700"
          aria-hidden
        >
          <ShieldAlert size={22} />
        </span>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-institucional">
          Tu perfil no tiene módulos asignados
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {perfil
            ? `Entraste como ${perfil.nombre}, pero el administrador todavía no te ha
               concedido acceso a ninguna sección de ATLAS.`
            : 'No hay una sesión activa.'}
        </p>

        <p className="mt-4 text-sm text-texto-secundario">
          Solicita los permisos al administrador de tu institución.
        </p>

        <form action={salir} className="mt-6">
          <button type="submit" className={clasesBoton('secundario', 'md')}>
            Salir
          </button>
        </form>
      </div>
    </main>
  )
}
