import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { perfilActual } from '@/lib/auth/sesion'
import { FormularioEntrada } from './formulario'
import { COMPETENCIAS_EXPLICADAS } from '@/lib/kpi/metodologia'

export const metadata = { title: 'Entrar · ATLAS' }

export default async function PaginaEntrar() {
  // Con sesión válida no tiene sentido mostrar el formulario.
  const perfil = await perfilActual()
  if (perfil) redirect('/inicio')

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* ---------- Columna de marca (oculta en móvil) ---------- */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br
                          from-institucional to-institucional-claro p-12 lg:flex lg:flex-col
                          lg:justify-between">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-white/5"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-white/5"
          aria-hidden
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15
                       text-base font-bold text-white"
            aria-hidden
          >
            A
          </span>
          <span className="text-xl font-semibold tracking-tight text-white">ATLAS</span>
        </Link>

        <div className="relative">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">
            Lo que un estudiante hace, traducido a lo que sabe hacer.
          </h2>
          <ul className="mt-8 space-y-2.5">
            {COMPETENCIAS_EXPLICADAS.map((c) => (
              <li key={c.indice} className="flex items-center gap-2.5 text-sm text-white/75">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" aria-hidden />
                {c.competencia}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          Analítica de competencias transversales
        </p>
      </section>

      {/* ---------- Columna del formulario ---------- */}
      <section className="flex items-center justify-center bg-superficie-pagina p-6">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-texto-secundario
                       transition hover:text-institucional lg:hidden"
          >
            <ArrowLeft size={15} aria-hidden />
            Volver
          </Link>

          <div className="mb-6 lg:hidden">
            <h1 className="text-3xl font-semibold tracking-tight text-institucional">ATLAS</h1>
            <p className="mt-1 text-sm text-texto-secundario">
              Analítica de competencias transversales
            </p>
          </div>

          <div className="rounded-tarjeta border border-superficie-borde bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-institucional">
              Entrar
            </h2>
            <p className="mb-6 mt-1 text-sm text-texto-secundario">
              Usa el correo con el que te registró tu institución.
            </p>
            <FormularioEntrada />
          </div>

          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-texto-secundario">
            <ShieldCheck size={14} className="mt-px shrink-0" aria-hidden />
            El acceso lo otorga el administrador de tu institución. Si no puedes
            entrar, solicítaselo a él.
          </p>
        </div>
      </section>
    </main>
  )
}
