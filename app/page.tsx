import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight, BarChart3, Building2, GraduationCap, LayoutGrid,
  ShieldCheck, Sparkles, Target,
} from 'lucide-react'
import { perfilActual } from '@/lib/auth/sesion'
import { BotonEnlace } from '@/componentes/ui/boton'
import { COMPETENCIAS_EXPLICADAS } from '@/lib/kpi/metodologia'

export const metadata = {
  title: 'ATLAS · Analítica de competencias transversales',
  description:
    'Mide las competencias transversales de cada estudiante a partir de su ' +
    'actividad real y convierte los indicadores en acciones pedagógicas.',
}

/**
 * Landing pública.
 *
 * Quien ya tiene sesión no la ve: va directo a su panel de inicio. Sólo se
 * presenta a quien todavía no ha entrado.
 */
export default async function Portada() {
  const perfil = await perfilActual()
  if (perfil) redirect('/inicio')

  return (
    <div className="min-h-screen bg-white">
      {/* ---------- Cabecera ---------- */}
      <header className="sticky top-0 z-40 border-b border-superficie-borde bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg
                         bg-institucional text-sm font-bold text-white"
              aria-hidden
            >
              A
            </span>
            <span className="text-lg font-semibold tracking-tight text-institucional">
              ATLAS
            </span>
          </div>
          <BotonEnlace href="/entrar" tamano="sm">
            Entrar
            <ArrowRight size={15} aria-hidden />
          </BotonEnlace>
        </div>
      </header>

      {/* ---------- Portada ---------- */}
      <section className="relative overflow-hidden border-b border-superficie-borde">
        {/* Fondo: degradado suave del azul institucional, sin imagen que cargar. */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br
                     from-institucional via-institucional-claro to-[#16284a]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full
                     bg-white/5 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full
                     bg-white/5 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20
                        bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
            <Sparkles size={13} aria-hidden />
            Analítica de competencias transversales
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight
                         text-white lg:text-6xl">
            Lo que un estudiante hace,
            <br />
            traducido a lo que sabe hacer.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 lg:text-lg">
            ATLAS mide cinco competencias transversales a partir de la actividad real
            en la plataforma y de la evaluación del docente. No se queda en el
            porcentaje: señala dónde está la carencia y propone qué hacer.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <BotonEnlace href="/entrar" tamano="lg" variante="secundario">
              Entrar a la plataforma
              <ArrowRight size={17} aria-hidden />
            </BotonEnlace>
            <Link
              href="#competencias"
              className="rounded-lg px-4 py-2.5 text-[15px] font-medium text-white/80
                         transition hover:bg-white/10 hover:text-white"
            >
              Ver qué mide
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Qué hace ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icono: BarChart3,
              titulo: 'Mide con la actividad real',
              texto:
                'Veintidós sub-indicadores calculados sobre los registros de la ' +
                'plataforma y la rúbrica del docente. Cada uno se calcula por ' +
                'estudiante, nunca como un total del grupo.',
            },
            {
              icono: Target,
              titulo: 'Señala dónde intervenir',
              texto:
                'El embudo de progresión muestra en qué etapa se pierde la gente, ' +
                'y la escala de dominio dice cuántos puntos faltan para el ' +
                'siguiente nivel.',
            },
            {
              icono: Sparkles,
              titulo: 'Propone qué hacer',
              texto:
                'Un agente redacta recomendaciones pedagógicas concretas, alineadas ' +
                'con el perfil de egreso del programa. Ninguna se aplica sin que un ' +
                'docente la revise.',
            },
          ].map((c) => (
            <article
              key={c.titulo}
              className="rounded-tarjeta border border-superficie-borde bg-white p-6
                         transition hover:border-institucional/30 hover:shadow-sm"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg
                           bg-institucional-suave text-institucional"
                aria-hidden
              >
                <c.icono size={19} />
              </span>
              <h2 className="mt-4 text-base font-semibold text-institucional">
                {c.titulo}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Las cinco competencias ---------- */}
      <section
        id="competencias"
        className="scroll-mt-16 border-y border-superficie-borde bg-superficie-pagina"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-institucional lg:text-3xl">
            Cinco competencias transversales
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Cada una se resume en un índice y se desglosa en los sub-indicadores que
            la componen. Todas se leen con la misma escala de dominio.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETENCIAS_EXPLICADAS.map((c) => (
              <article
                key={c.indice}
                className="rounded-tarjeta border border-superficie-borde bg-white p-5"
              >
                <h3 className="text-sm font-semibold text-institucional">
                  {c.competencia}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {c.descripcion}
                </p>
                <p className="mt-3 text-xs text-texto-secundario">
                  {c.subIndicadores.length} sub-indicadores
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Para quién ---------- */}
      <section className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-institucional lg:text-3xl">
          Una vista por cada responsabilidad
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Cada perfil ve exactamente el ámbito que le corresponde. El alcance se
          aplica en el servidor: ninguna consulta se ejecuta sin él.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icono: Building2, rol: 'Administrador', texto: 'Todas las universidades y programas.' },
            { icono: GraduationCap, rol: 'Coordinador', texto: 'Su programa académico completo.' },
            { icono: LayoutGrid, rol: 'Docente', texto: 'El curso a su cargo y su rúbrica.' },
            { icono: Target, rol: 'Estudiante', texto: 'Su propio avance, nada más.' },
          ].map((p) => (
            <article
              key={p.rol}
              className="rounded-tarjeta border border-superficie-borde bg-white p-5"
            >
              <span className="text-institucional" aria-hidden>
                <p.icono size={18} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-institucional">{p.rol}</h3>
              <p className="mt-1 text-sm text-slate-600">{p.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Cierre ---------- */}
      <section className="border-t border-superficie-borde bg-institucional">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 py-14
                        sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white lg:text-2xl">
              Entra con tu cuenta institucional
            </h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/70">
              <ShieldCheck size={15} aria-hidden />
              El acceso lo otorga el administrador de tu institución.
            </p>
          </div>
          <BotonEnlace href="/entrar" tamano="lg" variante="secundario">
            Entrar
            <ArrowRight size={17} aria-hidden />
          </BotonEnlace>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-8">
        <p className="text-xs text-texto-secundario">
          ATLAS · Analítica de competencias transversales
        </p>
      </footer>
    </div>
  )
}
