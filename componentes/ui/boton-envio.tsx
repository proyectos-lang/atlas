'use client'

import { useFormStatus } from 'react-dom'
import { clasesBoton, type TamanoBoton, type VarianteBoton } from './boton'

/**
 * Botón de envío que se deshabilita solo mientras la acción corre.
 *
 * Reemplaza los `Boton()` locales que cada formulario repetía. `useFormStatus`
 * exige que el componente sea hijo del <form>, no el propio form.
 */
export function BotonEnvio({
  children,
  enProgreso,
  variante = 'primario',
  tamano = 'md',
  className = '',
}: {
  children: React.ReactNode
  /** Texto mientras se envía. Sin él se mantiene el mismo rótulo. */
  enProgreso?: React.ReactNode
  variante?: VarianteBoton
  tamano?: TamanoBoton
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={clasesBoton(variante, tamano, className)}
    >
      {pending && (
        <span
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2
                     border-current border-t-transparent"
          aria-hidden
        />
      )}
      {pending ? (enProgreso ?? children) : children}
    </button>
  )
}
