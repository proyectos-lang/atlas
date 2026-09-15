import Link from 'next/link'

/**
 * Botones del sistema.
 *
 * Antes cada formulario definía su propio `Boton()` local repitiendo la
 * misma cadena de clases. Aquí viven una sola vez, en variantes con nombre.
 *
 * `Boton` es Server Component: no lleva `'use client'` ni estado. Para el
 * estado de envío de un formulario está `BotonEnvio`, que sí es cliente.
 */

export type VarianteBoton = 'primario' | 'secundario' | 'discreto' | 'peligro'
export type TamanoBoton = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium ' +
  'transition focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-institucional focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

const VARIANTES: Record<VarianteBoton, string> = {
  primario:
    'bg-institucional text-white shadow-sm hover:bg-institucional-claro ' +
    'active:translate-y-px',
  secundario:
    'border border-superficie-borde bg-white text-institucional ' +
    'hover:border-institucional/40 hover:bg-institucional-suave active:translate-y-px',
  discreto:
    'text-institucional hover:bg-institucional-suave active:translate-y-px',
  peligro:
    'border border-red-200 bg-white text-red-700 hover:bg-red-50 active:translate-y-px',
}

const TAMANOS: Record<TamanoBoton, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-[15px]',
}

export function clasesBoton(
  variante: VarianteBoton = 'primario',
  tamano: TamanoBoton = 'md',
  extra = ''
): string {
  return [BASE, VARIANTES[variante], TAMANOS[tamano], extra].filter(Boolean).join(' ')
}

export function Boton({
  variante = 'primario',
  tamano = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton
  tamano?: TamanoBoton
}) {
  return <button className={clasesBoton(variante, tamano, className)} {...props} />
}

/** Mismo aspecto que `Boton`, pero navega. */
export function BotonEnlace({
  href,
  variante = 'primario',
  tamano = 'md',
  className = '',
  children,
}: {
  href: string
  variante?: VarianteBoton
  tamano?: TamanoBoton
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={clasesBoton(variante, tamano, className)}>
      {children}
    </Link>
  )
}
