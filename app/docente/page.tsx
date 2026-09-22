import { exigirSesion } from '@/lib/auth/sesion'
import { descriptiva, diagnostica } from '@/lib/analitica/modelo'
import { PanelCompetencias, resumirCompetencias } from '@/componentes/panel-competencias'
import { Pagina, SinResultados } from '@/componentes/pagina'
import { AvisoDatosSemilla, FilaTarjetas } from '@/componentes/fila-tarjetas'
import { resolverFiltros, seleccionDe } from '@/lib/kpi/filtros'
import { alcanceVacio } from '@/lib/auth/alcance'
import { conteos, estudiantes } from '@/lib/kpi/consultas'
import {
  embudo, indicadoresIlo, indices, indicesPorEstudiante,
} from '@/lib/kpi/indicadores'
import { Tarjeta } from '@/componentes/graficos/base'
import { Dispersion } from '@/componentes/graficos/dispersion'
import { RadarCompetencias } from '@/componentes/graficos/radar'
import { Matriz } from '@/componentes/graficos/matriz'
import { Embudo } from '@/componentes/graficos/embudo'
import { COMPETENCIAS } from '@/lib/kpi/catalogo'

export const metadata = { title: 'Docente · ATLAS' }

export default async function PaginaDocente({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { perfil, alcance } = await exigirSesion('/docente')
  const f = await resolverFiltros(alcance, seleccionDe(await searchParams))

  if (alcanceVacio(f.alcance)) {
    return (
      <Pagina perfil={perfil} titulo="Docente" controles={f.controles}>
        <SinResultados />
      </Pagina>
    )
  }

  const [c, listaEst, i, ilo, porEst, emb] = await Promise.all([
    conteos(f.alcance),
    estudiantes(f.alcance),
    indices(f.alcance, { semanas: f.semanas }),
    indicadoresIlo(f.alcance),
    indicesPorEstudiante(f.alcance, { semanas: f.semanas }),
    embudo(f.alcance),
  ])

  // Analítica sobre el modelo de dimensiones. Va aparte del Promise.all
  // anterior para no tocar las consultas ya verificadas de este tablero.
  const [desc, diag] = await Promise.all([
    descriptiva(f.alcance, f.semanas),
    diagnostica(f.alcance, f.semanas),
  ])
  const resumen = resumirCompetencias(desc, diag)

  const codigoEst = new Map(listaEst.map((e) => [e.id, e.codigo]))

  const radar = [
    { competencia: 'Trabajo en Equipo', valor: i.ite ?? 0 },
    { competencia: 'Aprendizaje Autónomo', valor: i.iau ?? 0 },
    { competencia: 'Comunicación Efectiva', valor: i.icom ?? 0 },
    { competencia: 'Pensamiento Crítico', valor: i.ipc ?? 0 },
    { competencia: 'Resolución de Problemas', valor: i.irp ?? 0 },
  ]

  // Matriz estudiante x competencia, con formato condicional.
  const matriz = porEst
    .slice()
    .sort((a, b) =>
      (codigoEst.get(a.usuarioId) ?? '').localeCompare(codigoEst.get(b.usuarioId) ?? ''))
    .map((e) => ({
      etiqueta: codigoEst.get(e.usuarioId) ?? String(e.usuarioId),
      valores: [e.ite, e.iau, e.icom, e.ipc, e.irp],
    }))

  return (
    <Pagina perfil={perfil} titulo="Docente" controles={f.controles}>
      <div className="space-y-5">
        <PanelCompetencias
          resumen={resumen}
          pie="Qué dimensión concreta falla en tu curso, no sólo cuánto. Se calcula sobre las evidencias registradas."
        />
        <FilaTarjetas conteos={c} ctg={i.ctg} ilra={ilo.ilra} />

        <AvisoDatosSemilla />

        <div className="grid gap-5 xl:grid-cols-2">
          <Tarjeta
            titulo="Dispersión de riesgo"
            subtitulo="Eje horizontal Índice de Aprendizaje Autónomo; eje vertical Desempeño en Problemas Aplicados"
          >
            <Dispersion
              datos={porEst.map((e) => ({
                estudiante: codigoEst.get(e.usuarioId) ?? String(e.usuarioId),
                x: e.iau,
                y: e.irp,
              }))}
              ejeY="Índice de Resolución de Problemas"
            />
          </Tarjeta>

          <Tarjeta
            titulo="Embudo de progresión académica"
            subtitulo="Cuántos estudiantes del curso llegan a cada etapa"
          >
            <Embudo etapas={emb} />
          </Tarjeta>

          <Tarjeta
            titulo="Radar de competencias"
            subtitulo="Promedio del curso en los cinco índices"
          >
            <RadarCompetencias datos={radar} />
          </Tarjeta>

          <Tarjeta
            titulo="Matriz estudiante por competencia"
            subtitulo="Color según la escala de dominio: rojo bajo 60, amarillo 60 a 74, verde claro 75 a 89, verde 90 o más"
          >
            <Matriz
              etiquetaFila="Estudiante"
              columnas={[...COMPETENCIAS]}
              filas={matriz}
            />
          </Tarjeta>
        </div>
      </div>
    </Pagina>
  )
}
