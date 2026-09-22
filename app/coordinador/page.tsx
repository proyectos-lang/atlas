import { exigirSesion } from '@/lib/auth/sesion'
import { descriptiva, diagnostica } from '@/lib/analitica/modelo'
import { PanelCompetencias, resumirCompetencias } from '@/componentes/panel-competencias'
import { Pagina, SinResultados } from '@/componentes/pagina'
import { FilaTarjetas } from '@/componentes/fila-tarjetas'
import { resolverFiltros, seleccionDe } from '@/lib/kpi/filtros'
import { alcanceVacio } from '@/lib/auth/alcance'
import { conteos, cursos } from '@/lib/kpi/consultas'
import {
  embudo, evolucionSemanal, indiceGlobalPorCurso,
  indicadoresIlo, indices, indicesPorEstudiante,
} from '@/lib/kpi/indicadores'
import { Tarjeta } from '@/componentes/graficos/base'
import { BarrasHorizontales } from '@/componentes/graficos/barras'
import { Linea } from '@/componentes/graficos/linea'
import { RadarCompetencias } from '@/componentes/graficos/radar'
import { Matriz } from '@/componentes/graficos/matriz'
import { Embudo } from '@/componentes/graficos/embudo'
import { COMPETENCIAS } from '@/lib/kpi/catalogo'

export const metadata = { title: 'Coordinador Académico · ATLAS' }

export default async function PaginaCoordinador({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { perfil, alcance } = await exigirSesion('/coordinador')
  const f = await resolverFiltros(alcance, seleccionDe(await searchParams))

  if (alcanceVacio(f.alcance)) {
    return (
      <Pagina perfil={perfil} titulo="Coordinador Académico" controles={f.controles}>
        <SinResultados />
      </Pagina>
    )
  }

  const [c, listaCursos, i, ilo, porCurso, evolucion, emb, porEst] = await Promise.all([
    conteos(f.alcance),
    cursos(f.alcance),
    indices(f.alcance, { semanas: f.semanas }),
    indicadoresIlo(f.alcance),
    indiceGlobalPorCurso(f.alcance, { semanas: f.semanas }),
    evolucionSemanal(f.alcance),
    embudo(f.alcance),
    indicesPorEstudiante(f.alcance, { semanas: f.semanas }),
  ])

  // Analítica sobre el modelo de dimensiones. Va aparte del Promise.all
  // anterior para no tocar las consultas ya verificadas de este tablero.
  const [desc, diag] = await Promise.all([
    descriptiva(f.alcance, f.semanas),
    diagnostica(f.alcance, f.semanas),
  ])
  const resumen = resumirCompetencias(desc, diag)

  const nombreCurso = new Map(listaCursos.map((x) => [x.id, x.nombre]))

  const radar = [
    { competencia: 'Trabajo en Equipo', valor: i.ite ?? 0 },
    { competencia: 'Aprendizaje Autónomo', valor: i.iau ?? 0 },
    { competencia: 'Comunicación Efectiva', valor: i.icom ?? 0 },
    { competencia: 'Pensamiento Crítico', valor: i.ipc ?? 0 },
    { competencia: 'Resolución de Problemas', valor: i.irp ?? 0 },
  ]

  const matriz = listaCursos.map((cu) => {
    const suyos = porEst.filter((e) => e.cursoId === cu.id)
    const med = (k: 'ite' | 'iau' | 'icom' | 'ipc' | 'irp') =>
      suyos.length ? suyos.reduce((a, b) => a + b[k], 0) / suyos.length : null
    return {
      etiqueta: cu.nombre,
      valores: [med('ite'), med('iau'), med('icom'), med('ipc'), med('irp')],
    }
  })

  return (
    <Pagina perfil={perfil} titulo="Coordinador Académico" controles={f.controles}>
      <div className="space-y-5">
        <PanelCompetencias
          resumen={resumen}
          pie="Comportamiento de las competencias en el programa, desglosado por dimensión."
        />
        <FilaTarjetas conteos={c} ctg={i.ctg} ilra={ilo.ilra} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Tarjeta
            titulo="Índice global por curso"
            subtitulo="Eje curso; valor de la Competencia Transversal Global, orden descendente"
            codigoKpi="CTG"
          >
            <BarrasHorizontales
              datos={porCurso.map((p) => ({
                etiqueta: nombreCurso.get(p.cursoId) ?? String(p.cursoId),
                valor: p.ctg,
              }))}
            />
          </Tarjeta>

          {/* Título exacto solicitado por el usuario final. */}
          <Tarjeta
            titulo="Evolución del logro de resultados de aprendizaje"
            subtitulo="Eje semana 1 a 6; los cinco índices de competencia"
          >
            <Linea
              datos={evolucion.map((e) => ({
                semana: e.semana, ite: e.ite, iau: e.iau,
                icom: e.icom, ipc: e.ipc, irp: e.irp,
              }))}
              series={[
                { clave: 'ite', nombre: 'Trabajo en Equipo' },
                { clave: 'iau', nombre: 'Aprendizaje Autónomo' },
                { clave: 'icom', nombre: 'Comunicación Efectiva' },
                { clave: 'ipc', nombre: 'Pensamiento Crítico' },
                { clave: 'irp', nombre: 'Resolución de Problemas' },
              ]}
              alto={300}
            />
          </Tarjeta>
        </div>

        <Tarjeta
          titulo="Embudo de progresión académica"
          subtitulo="Cuántos estudiantes llegan a cada etapa y qué criterio los define"
        >
          <Embudo etapas={emb} />
        </Tarjeta>

        <div className="grid gap-5 xl:grid-cols-2">
          <Tarjeta
            titulo="Radar de competencias"
            subtitulo="Los cinco índices del ámbito seleccionado"
          >
            <RadarCompetencias datos={radar} />
          </Tarjeta>

          <Tarjeta
            titulo="Matriz curso por competencia"
            subtitulo="Color según la escala de dominio; fila de total en negrita"
          >
            <Matriz etiquetaFila="Curso" columnas={[...COMPETENCIAS]} filas={matriz} />
          </Tarjeta>
        </div>
      </div>
    </Pagina>
  )
}
