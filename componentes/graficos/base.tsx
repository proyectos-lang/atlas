import { nivelDe } from '@/lib/kpi/escala'
import { AVISO_SEMILLA, mostrarAvisoSemilla, nombreDe } from '@/lib/kpi/catalogo'

/**
 * Piezas base del sistema de diseño (§9).
 * Fondo #F5F6F8, tarjetas blancas con borde #E1E5EA y radio 8 px,
 * títulos en azul institucional con subtítulo gris.
 */

export function Tarjeta({
  titulo,
  subtitulo,
  codigoKpi,
  destacada = false,
  className = '',
  children,
}: {
  titulo?: string
  subtitulo?: string
  /** Si el indicador incluye criterios de rúbrica sin calificar, se avisa. */
  codigoKpi?: string
  destacada?: boolean
  className?: string
  children: React.ReactNode
}) {
  const semilla = codigoKpi ? mostrarAvisoSemilla(codigoKpi) : false

  return (
    <section
      className={`min-w-0 rounded-tarjeta border bg-white p-4 ${
        destacada
          ? 'border-institucional bg-institucional-suave'
          : 'border-superficie-borde'
      } ${className}`}
    >
      {titulo && (
        <header className="mb-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-institucional">
            {titulo}
            {semilla && <AvisoSemilla />}
          </h3>
          {subtitulo && (
            <p className="mt-0.5 text-xs text-texto-secundario">{subtitulo}</p>
          )}
        </header>
      )}
      {children}
    </section>
  )
}

/** Ícono de advertencia para indicadores calculados sobre datos semilla. */
export function AvisoSemilla({ className = '' }: { className?: string }) {
  return (
    <span
      title={AVISO_SEMILLA}
      aria-label={AVISO_SEMILLA}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full
                  bg-amber-100 text-[10px] font-bold text-amber-800 ${className}`}
    >
      !
    </span>
  )
}

/**
 * Badge de nivel de dominio. La identidad nunca es solo el color:
 * siempre lleva el nombre del nivel escrito.
 */
export function BadgeNivel({
  valor,
  className = '',
}: {
  valor: number | null
  className?: string
}) {
  if (valor === null) {
    return (
      <span className={`rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 ${className}`}>
        Sin datos
      </span>
    )
  }
  const n = nivelDe(valor)
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      style={{ backgroundColor: n.color, color: n.colorTexto }}
    >
      {n.nivel}
    </span>
  )
}

/**
 * Valor de indicador. Cuando no hay datos muestra guion largo y leyenda,
 * nunca 0 %: un cero afirmaría un resultado que no se midió.
 */
export function Valor({
  valor,
  escala = 'Porcentaje',
  decimales = 1,
  className = '',
}: {
  valor: number | null
  escala?: 'Porcentaje' | 'Puntos'
  decimales?: number
  className?: string
}) {
  if (valor === null || !Number.isFinite(valor)) {
    return (
      <span className={className}>
        <span aria-hidden>—</span>
        <span className="sr-only">sin resultados aún</span>
      </span>
    )
  }
  const texto = valor.toFixed(decimales).replace('.', ',')
  return (
    <span className={className}>
      {escala === 'Puntos' ? `${texto} pts` : `${texto} %`}
    </span>
  )
}

export function SinDatos({ children = 'sin resultados aún' }: { children?: string }) {
  return <p className="text-xs text-texto-secundario">{children}</p>
}

/**
 * Tarjeta institucional de la fila de nueve.
 * Borde superior de 3 px; las dos destacadas llevan borde azul y fondo suave.
 */
export function TarjetaIndicador({
  titulo,
  valor,
  pie,
  destacada = false,
  badge = false,
  codigoKpi,
  escala = 'Porcentaje',
  decimales = 1,
}: {
  titulo: string
  valor: number | null
  pie: string
  destacada?: boolean
  badge?: boolean
  codigoKpi?: string
  escala?: 'Porcentaje' | 'Puntos'
  decimales?: number
}) {
  const semilla = codigoKpi ? mostrarAvisoSemilla(codigoKpi) : false
  const sinDato = valor === null || !Number.isFinite(valor)

  return (
    <div
      className={`rounded-tarjeta border border-t-[3px] p-3 ${
        destacada
          ? 'border-institucional border-t-institucional bg-institucional-suave'
          : 'border-superficie-borde border-t-institucional bg-white'
      }`}
    >
      <p className="flex items-start gap-1 text-xs text-texto-secundario">
        <span className="flex-1">{titulo}</span>
        {semilla && <AvisoSemilla />}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Valor
          valor={valor}
          escala={escala}
          decimales={decimales}
          className="whitespace-nowrap text-2xl font-semibold text-institucional"
        />
        {badge && !sinDato && <BadgeNivel valor={valor} />}
      </div>
      <p className="mt-1 text-[11px] leading-tight text-texto-secundario">
        {sinDato ? 'sin resultados aún' : pie}
      </p>
    </div>
  )
}

/** Conteo simple (cursos, docentes, estudiantes...). */
export function TarjetaConteo({
  titulo, conteo, pie, sinRegistros = false,
}: {
  titulo: string
  conteo: number
  pie: string
  sinRegistros?: boolean
}) {
  return (
    <div className="rounded-tarjeta border border-superficie-borde border-t-[3px] border-t-institucional bg-white p-3">
      <p className="text-xs text-texto-secundario">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-institucional">
        {sinRegistros ? <span aria-hidden>—</span> : conteo}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-texto-secundario">{pie}</p>
    </div>
  )
}

/** Etiqueta de indicador: siempre el nombre completo, nunca el código. */
export function NombreIndicador({ codigo }: { codigo: string }) {
  return <>{nombreDe(codigo)}</>
}
