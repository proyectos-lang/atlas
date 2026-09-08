import { redirect } from 'next/navigation'
import { perfilActual } from '@/lib/auth/sesion'
import { INICIO_POR_ROL } from '@/lib/auth/alcance'
import { FormularioEntrada } from './formulario'

export const metadata = { title: 'Entrar · ATLAS' }

export default async function PaginaEntrar() {
  // Con sesión válida no tiene sentido mostrar el formulario.
  const perfil = await perfilActual()
  if (perfil) redirect(INICIO_POR_ROL[perfil.rol])

  return (
    <main className="flex min-h-screen items-center justify-center bg-superficie-pagina p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-institucional">ATLAS</h1>
          <p className="mt-1 text-sm text-texto-secundario">
            Analítica de competencias transversales
          </p>
        </div>

        <div className="rounded-tarjeta border border-superficie-borde bg-white p-6 shadow-sm">
          <FormularioEntrada />
        </div>

        <p className="mt-4 text-center text-xs text-texto-secundario">
          ¿No tienes acceso? Solicítalo al administrador de tu institución.
        </p>
      </div>
    </main>
  )
}
