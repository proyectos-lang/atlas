import { exigirSesion } from '@/lib/auth/sesion'
import { Pagina, SinResultados } from '@/componentes/pagina'
import { resolverFiltros, seleccionDe } from '@/lib/kpi/filtros'
import { alcanceVacio, aplicarFiltros } from '@/lib/auth/alcance'
import { estudiantes } from '@/lib/kpi/consultas'
import {
  evolucionSemanal, indices, indicesPorEstudiante, tlcPorIlo,
} from '@/lib/kpi/indicadores'
import { BadgeNivel, Tarjeta, Valor } from '@/componentes/graficos/base'
import { TarjetaCompetencia } from '@/componentes/graficos/tarjeta-competencia'
import { Medidor } from '@/componentes/graficos/medidor'
import { BarrasVerticales } from '@/componentes/graficos/barras'
import { Linea } from '@/componentes/graficos/linea'
import { SelectorEstudiante } from '@/componentes/selector-estudiante'
import { COMPETENCIAS } from '@/lib/kpi/catalogo'

export const metadata = { title: 'Estudiante · ATLAS' }

export default async function PaginaEstudiante({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { perfil, alcance } = await exigirSesion('/estudiante')
  const params = await searchParams
  const f = await resolverFiltros(alcance, seleccionDe(params))

  if (alcanceVacio(f.alcance)) {
    return (
      <Pagina perfil={perfil} titulo="Estudiante" controles={f.controles}>
        <SinResultados />
      </Pagina>
    )
  }

  const listaEst = await estudiantes(f.alcance)

  // Si el perfil es estudiante, queda fijo en él mismo y no puede elegir otro.
  const fijo = perfil.rol === 'estudiante'
  const pedido = Array.isArray(params.estudiante) ? params.estudiante[0] : params.estudiante
  const elegido = fijo
    ? listaEst[0]
    : listaEst.find((e) => e.codigo === pedido)

  // El alcance del detalle se restringe al estudiante elegido.
  const ambito = elegido
    ? aplicarFiltros(f.alcance, { usuarioIds: [elegido.id] })
    : f.alcance

  const [i, porEst, tlc, evolucion] = await Promise.all([
    indices(ambito, { semanas: f.semanas }),
    indicesPorEstudiante(ambito, { semanas: f.semanas }),
    tlcPorIlo(ambito, { ilo: f.ilo, competencia: f.competencia }),
    evolucionSemanal(ambito),
  ])

  const valores = [i.ite, i.iau, i.icom, i.ipc, i.irp]
  const titulo = elegido ? `Mi progreso · ${elegido.codigo}` : 'Promedio del curso'

  return (
    <Pagina perfil={perfil} titulo="Estudiante" controles={f.controles}>
      <div className="space-y-5">
        {/* Encabezado */}
        <div className="rounded-tarjeta border border-superficie-borde bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-institucional">{titulo}</h2>
              <p className="mt-0.5 text-xs text-texto-secundario">
                {elegido
                  ? 'Competencia Transversal Global y detalle por competencia'
                  : 'Selecciona un estudiante para ver su detalle individual'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Valor
                valor={i.ctg}
                className="text-3xl font-semibold text-institucional"
              />
              <BadgeNivel valor={i.ctg} />
            </div>
          </div>

          {!fijo && (
            <div className="mt-4 border-t border-superficie-borde pt-3">
              <SelectorEstudiante
                opciones={listaEst.map((e) => ({ valor: e.codigo, etiqueta: e.codigo }))}
                seleccionado={elegido?.codigo ?? ''}
              />
            </div>
          )}
        </div>

        {porEst.length === 0 ? (
          <SinResultados />
        ) : (
          <>
            {/* Cinco tarjetas de competencia */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {COMPETENCIAS.map((comp, n) => (
                <TarjetaCompetencia
                  key={comp}
                  competencia={comp}
                  valor={valores[n]}
                  // Pensamiento Crítico y Resolución de Problemas incluyen rúbrica.
                  conAviso={n >= 3}
                />
              ))}
            </div>

            {/* Cinco medidores semicirculares */}
            <Tarjeta
              titulo="Nivel por competencia"
              subtitulo="La marca gris sobre el arco señala la meta del siguiente nivel"
            >
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-5">
                {COMPETENCIAS.map((comp, n) => (
                  <Medidor key={comp} valor={valores[n]} competencia={comp} />
                ))}
              </div>
            </Tarjeta>

            <div className="grid gap-5 xl:grid-cols-2">
              <Tarjeta
                titulo="Tasa de logro por competencia"
                subtitulo="Eje resultado de aprendizaje; valor del logro alcanzado"
              >
                <BarrasVerticales
                  datos={tlc.map((t) => ({ etiqueta: t.ilo, valor: t.tlc }))}
                />
              </Tarjeta>

              <Tarjeta
                titulo="Evolución del índice global"
                subtitulo="Competencia Transversal Global semana a semana"
              >
                <Linea
                  datos={evolucion.map((e) => ({ semana: e.semana, ctg: e.ctg }))}
                  series={[{ clave: 'ctg', nombre: 'Competencia Transversal Global' }]}
                />
              </Tarjeta>
            </div>
          </>
        )}
      </div>
    </Pagina>
  )
}
