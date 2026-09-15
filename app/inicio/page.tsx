import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { exigirSesion } from '@/lib/auth/sesion'
import { INICIO_POR_ROL } from '@/lib/auth/alcance'
import { Marco } from '@/componentes/marco'
import { navegacionDe } from '@/lib/auth/navegacion'
import { BotonEnlace } from '@/componentes/ui/boton'
import { conteos } from '@/lib/kpi/consultas'
import { indices } from '@/lib/kpi/indicadores'
import { nivelDe, metaDe } from '@/lib/kpi/escala'

export const metadata = { title: 'Inicio · ATLAS' }

/**
 * Panel de bienvenida.
 *
 * Es la primera pantalla tras entrar: dice dónde está el usuario y adónde
 * puede ir, en vez de soltarlo directamente en un tablero lleno de cifras.
 * No duplica los gráficos del tablero: sólo una cifra de contexto y accesos.
 */

const SALUDO_ROL: Record<string, string> = {
  admin: 'Tienes visibilidad sobre todas las universidades y programas.',
  coordinador: 'Estás viendo el programa académico a tu cargo.',
  asesor: 'Estás viendo el ámbito de asesoría que te fue asignado.',
  docente: 'Estás viendo el curso a tu cargo.',
  estudiante: 'Este es tu avance personal en las competencias transversales.',
}

export default async function PaginaInicio() {
  const { perfil, alcance } = await exigirSesion('/inicio')

  const [c, i] = await Promise.all([
    conteos(alcance),
    indices(alcance, { semanas: null }),
  ])

  const grupos = navegacionDe(perfil.rol)
  const tableroPrincipal = INICIO_POR_ROL[perfil.rol]

  // Accesos rápidos: todo lo que el rol puede ver, menos el propio /inicio.
  const accesos = grupos.flatMap((g) =>
    g.items.filter((it) => it.ruta !== '/inicio').map((it) => ({ ...it, grupo: g.titulo }))
  )

  const ctg = i.ctg
  const nivel = ctg === null ? null : nivelDe(ctg)
  const meta = ctg === null ? null : metaDe(ctg)

  const nombreCorto = perfil.nombre.trim().split(/\s+/)[0]

  return (
    <Marco perfil={perfil} titulo="Inicio">
      <div className="space-y-5">
        {/* ---------- Bienvenida ---------- */}
        <section
          className="relative overflow-hidden rounded-tarjeta bg-gradient-to-br
                     from-institucional to-institucional-claro p-6 lg:p-8"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5"
            aria-hidden
          />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight text-white lg:text-3xl">
              Hola, {nombreCorto}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-white/75">
              {SALUDO_ROL[perfil.rol] ?? 'Bienvenido a ATLAS.'}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <BotonEnlace href={tableroPrincipal} variante="secundario">
                Ir a mi tablero
                <ArrowRight size={16} aria-hidden />
              </BotonEnlace>
              <Link
                href="/acerca-de"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-white/80
                           transition hover:bg-white/10 hover:text-white"
              >
                Cómo se calculan los indicadores
              </Link>
            </div>
          </div>
        </section>

        {/* ---------- Contexto ---------- */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaDato
            titulo="Competencia global"
            valor={ctg === null ? '—' : `${ctg.toFixed(1).replace('.', ',')} %`}
            pie={
              nivel === null
                ? 'Sin datos en tu ámbito'
                : meta?.meta === null
                  ? `Nivel ${nivel.nivel} · mantener`
                  : `Nivel ${nivel.nivel} · ${meta?.texto ?? ''}`
            }
            color={nivel?.color}
          />
          <TarjetaDato titulo="Estudiantes" valor={String(c.estudiantes)} pie="en tu ámbito" />
          <TarjetaDato titulo="Cursos" valor={String(c.cursos)} pie="con seguimiento activo" />
          <TarjetaDato
            titulo="Universidades"
            valor={String(c.universidades)}
            pie="y programas asociados"
          />
        </section>

        {/* ---------- Accesos ---------- */}
        <section className="rounded-tarjeta border border-superficie-borde bg-white p-6">
          <h2 className="text-lg font-semibold text-institucional">Todo lo que puedes hacer</h2>
          <p className="mt-1 text-sm text-texto-secundario">
            Estas son las secciones disponibles para tu perfil.
          </p>

          <div className="mt-5 space-y-5">
            {grupos.map((g) => (
              <div key={g.titulo}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-texto-secundario">
                  {g.titulo}
                </h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((it) => (
                    <Link
                      key={it.ruta}
                      href={it.ruta}
                      className="group flex items-start justify-between gap-3 rounded-lg
                                 border border-superficie-borde p-4 transition
                                 hover:border-institucional/40 hover:bg-institucional-suave"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">
                          {it.etiqueta}
                        </span>
                        {it.pie && (
                          <span className="mt-0.5 block text-xs text-texto-secundario">
                            {it.pie}
                          </span>
                        )}
                      </span>
                      <ArrowRight
                        size={15}
                        className="mt-0.5 shrink-0 text-texto-secundario transition
                                   group-hover:translate-x-0.5 group-hover:text-institucional"
                        aria-hidden
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {accesos.length === 0 && (
            <p className="mt-4 text-sm text-texto-secundario">
              Tu perfil todavía no tiene secciones asignadas. Contacta con el
              administrador de tu institución.
            </p>
          )}
        </section>
      </div>
    </Marco>
  )
}

function TarjetaDato({
  titulo,
  valor,
  pie,
  color,
}: {
  titulo: string
  valor: string
  pie: string
  color?: string
}) {
  return (
    <article className="rounded-tarjeta border border-superficie-borde bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-texto-secundario">
        {titulo}
      </p>
      <p
        className="mt-1.5 text-2xl font-semibold tracking-tight"
        style={color ? { color } : { color: '#1F3864' }}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-texto-secundario">{pie}</p>
    </article>
  )
}
