import { exigirSesion } from '@/lib/auth/sesion'
import { Pagina, SinResultados } from '@/componentes/pagina'
import { FilaTarjetas } from '@/componentes/fila-tarjetas'
import { resolverFiltros, seleccionDe } from '@/lib/kpi/filtros'
import { alcanceVacio } from '@/lib/auth/alcance'
import { conteos, cursos } from '@/lib/kpi/consultas'
import {
  evolucionSemanal, indiceGlobalPorCurso, indicadoresIlo,
  indices, indicesPorEstudiante,
} from '@/lib/kpi/indicadores'
import { Tarjeta } from '@/componentes/graficos/base'
import { BarrasHorizontales } from '@/componentes/graficos/barras'
import { Linea } from '@/componentes/graficos/linea'
import { RadarCompetencias } from '@/componentes/graficos/radar'
import { Matriz } from '@/componentes/graficos/matriz'
import { COMPETENCIAS } from '@/lib/kpi/catalogo'

export const metadata = { title: 'Administrador Institucional · ATLAS' }

export default async function PaginaAdministrador({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { perfil, alcance } = await exigirSesion('/administrador')
  const f = await resolverFiltros(alcance, seleccionDe(await searchParams))

  if (alcanceVacio(f.alcance)) {
    return (
      <Pagina perfil={perfil} titulo="Administrador Institucional" controles={f.controles}>
        <SinResultados />
      </Pagina>
    )
  }

  const [c, listaCursos, i, ilo, porCurso, evolucion, porEst] = await Promise.all([
    conteos(f.alcance),
    cursos(f.alcance),
    indices(f.alcance, { semanas: f.semanas }),
    indicadoresIlo(f.alcance),
    indiceGlobalPorCurso(f.alcance, { semanas: f.semanas }),
    // La evolución siempre recorre las seis semanas: el filtro de semana
    // acota el resto de visuales, no el gráfico que muestra el recorrido.
    evolucionSemanal(f.alcance),
    indicesPorEstudiante(f.alcance, { semanas: f.semanas }),
  ])

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
    <Pagina perfil={perfil} titulo="Administrador Institucional" controles={f.controles}>
      <div className="space-y-5">
        <FilaTarjetas conteos={c} ctg={i.ctg} ilra={ilo.ilra} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
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

          <Tarjeta
            titulo="Evolución por semana"
            subtitulo="Eje semana 1 a 6; sólo índices con seguimiento semanal"
          >
            <Linea
              datos={evolucion.map((e) => ({
                semana: e.semana, ite: e.ite, iau: e.iau, icom: e.icom,
              }))}
              series={[
                { clave: 'ite', nombre: 'Trabajo en Equipo' },
                { clave: 'iau', nombre: 'Aprendizaje Autónomo' },
                { clave: 'icom', nombre: 'Comunicación Efectiva' },
              ]}
            />
          </Tarjeta>

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
            <Matriz
              etiquetaFila="Curso"
              columnas={[...COMPETENCIAS]}
              filas={matriz}
            />
          </Tarjeta>
        </div>
      </div>
    </Pagina>
  )
}
