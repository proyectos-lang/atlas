import { Marco } from './marco'
import { BarraFiltros } from './barra-filtros'
import type { Filtro } from '@/lib/kpi/filtros'
import type { Perfil } from '@/lib/auth/alcance'

/** Marco con la barra de filtros ya montada. */
export function Pagina({
  perfil,
  titulo,
  controles,
  children,
}: {
  perfil: Perfil
  titulo: string
  controles: Filtro[]
  children: React.ReactNode
}) {
  return (
    <Marco perfil={perfil} titulo={titulo} lateral={<BarraFiltros controles={controles} />}>
      {children}
    </Marco>
  )
}

/** Mensaje cuando la combinación de filtros no deja ninguna fila. */
export function SinResultados() {
  return (
    <div className="rounded-tarjeta border border-superficie-borde bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-700">
        No hay datos para esta combinación de filtros
      </p>
      <p className="mt-1 text-xs text-texto-secundario">
        Prueba a quitar alguno desde la barra lateral.
      </p>
    </div>
  )
}
