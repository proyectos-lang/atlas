import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { perfilActual } from '@/lib/auth/sesion'
import { FormularioEntrada } from './formulario'
import { BienvenidaAnimada } from '@/componentes/bienvenida-animada'

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

        {/* En pantallas anchas, texto a la izquierda e ilustración alta a la
            derecha; en las medianas, apilados, porque la columna es la mitad
            de la ventana y el texto quedaría en una tira. El ancho de la
            imagen se limita por alto (proporción 2:3, para no empujar el pie
            fuera) y por ancho (para dejar sitio al texto). */}
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-10">
          <div className="min-w-0 flex-1">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-[1.75rem] 2xl:text-4xl">
              Lo que un estudiante hace, traducido a lo que sabe hacer.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              Cinco competencias transversales, medidas a partir de la
              actividad real y convertidas en acciones pedagógicas.
            </p>
          </div>
          <BienvenidaAnimada className="w-[min(300px,34vh)] shrink-0 xl:w-[min(400px,48vh,24vw)]" />
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
