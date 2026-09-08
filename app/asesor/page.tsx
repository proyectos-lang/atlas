import { exigirSesion } from '@/lib/auth/sesion'
import { Pagina, SinResultados } from '@/componentes/pagina'
import { AvisoDatosSemilla, FilaTarjetas, PanelSinSeguimiento } from '@/componentes/fila-tarjetas'
import { resolverFiltros, seleccionDe } from '@/lib/kpi/filtros'
import { alcanceVacio } from '@/lib/auth/alcance'
import { conteos, cursos, estudiantes } from '@/lib/kpi/consultas'
import {
  indicadoresAgente, indicadoresIlo, indices, indicesPorEstudiante,
  recomendaciones, tlcPorIloYCurso,
} from '@/lib/kpi/indicadores'
import { Tarjeta } from '@/componentes/graficos/base'
import { BarrasHorizontales, ColumnasApiladas } from '@/componentes/graficos/barras'
import { Matriz } from '@/componentes/graficos/matriz'
import { TablaRecomendaciones } from '@/componentes/tabla-recomendaciones'
import { GenerarRecomendaciones } from '@/componentes/generar-recomendaciones'
import { COMPETENCIAS } from '@/lib/kpi/catalogo'

export const metadata = { title: 'Asesor Pedagógico · ATLAS' }

export default async function PaginaAsesor({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { perfil, alcance } = await exigirSesion('/asesor')
  const f = await resolverFiltros(alcance, seleccionDe(await searchParams))

  if (alcanceVacio(f.alcance)) {
    return (
      <Pagina perfil={perfil} titulo="Asesor Pedagógico" controles={f.controles}>
        <SinResultados />
      </Pagina>
    )
  }

  const [c, listaCursos, listaEst, i, ilo, porEst, recos, tlcMatriz, agente] =
    await Promise.all([
      conteos(f.alcance),
      cursos(f.alcance),
      estudiantes(f.alcance),
      indices(f.alcance, { semanas: f.semanas }),
      indicadoresIlo(f.alcance),
      indicesPorEstudiante(f.alcance, { semanas: f.semanas }),
      recomendaciones(f.alcance, { competencia: f.competencia }),
      tlcPorIloYCurso(f.alcance),
      indicadoresAgente(f.alcance),
    ])

  const nombreEstudiante = Object.fromEntries(listaEst.map((e) => [e.id, e.codigo]))

  // Barras: recuento por texto de recomendación, orden descendente.
  const porTexto = new Map<string, number>()
  for (const r of recos) {
    porTexto.set(r.recomendacion, (porTexto.get(r.recomendacion) ?? 0) + 1)
  }
  const barras = [...porTexto.entries()]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  // Matriz ILO x curso con la Tasa de Logro por Competencia.
  const ilos = [...tlcMatriz.keys()].sort()
  const filasMatriz = ilos.map((codigo) => ({
    etiqueta: codigo,
    valores: listaCursos.map((cu) => tlcMatriz.get(codigo)?.get(cu.id) ?? null),
  }))

  // Recuento de competencia por nivel actual.
  const cuenta = (k: 'ite' | 'iau' | 'icom' | 'ipc' | 'irp') => {
    const r = { Básico: 0, Satisfactorio: 0, Alto: 0, Excelente: 0 }
    for (const e of porEst) {
      const v = e[k]
      if (v < 60) r.Básico++
      else if (v < 75) r.Satisfactorio++
      else if (v < 90) r.Alto++
      else r.Excelente++
    }
    return r
  }
  const apiladas = [
    { etiqueta: 'Trabajo en Equipo', ...cuenta('ite') },
    { etiqueta: 'Aprendizaje Autónomo', ...cuenta('iau') },
    { etiqueta: 'Comunicación Efectiva', ...cuenta('icom') },
    { etiqueta: 'Pensamiento Crítico', ...cuenta('ipc') },
    { etiqueta: 'Resolución de Problemas', ...cuenta('irp') },
  ].filter((a) => !f.competencia || a.etiqueta === f.competencia)

  return (
    <Pagina perfil={perfil} titulo="Asesor Pedagógico" controles={f.controles}>
      <div className="space-y-5">
        <FilaTarjetas conteos={c} ctg={i.ctg} ilra={ilo.ilra} />

        {/* §11.2: aviso visible cuando el ámbito incluye datos semilla. */}
        <AvisoDatosSemilla />

        <Tarjeta
          titulo="Asistente de recomendaciones"
          subtitulo="Genera recomendaciones a partir de los indicadores; el docente las revisa antes de aplicarlas"
        >
          <GenerarRecomendaciones
            cursos={listaCursos.map((cu) => ({ codigo: cu.codigo, nombre: cu.nombre }))}
            estudiantes={listaEst.map((e) => ({
              codigo: e.codigo,
              cursoCodigo: listaCursos.find((cu) => cu.id === e.cursoId)?.codigo ?? '',
            }))}
          />
        </Tarjeta>

        <div className="grid gap-5 xl:grid-cols-3">
          <Tarjeta
            titulo="Recomendaciones de IA"
            subtitulo="Recuento por recomendación, orden descendente"
          >
            <BarrasHorizontales
              datos={barras} sufijo="" maximo={Math.max(...barras.map((b) => b.valor), 1)}
              alto={330} anchoEtiqueta={190}
            />
          </Tarjeta>

          <Tarjeta
            titulo="Matriz de resultados de aprendizaje por curso"
            subtitulo="Tasa de Logro por Competencia en cada ILO"
          >
            <Matriz
              etiquetaFila="ILO"
              columnas={listaCursos.map((c2) => c2.nombre)}
              filas={filasMatriz}
            />
          </Tarjeta>

          <Tarjeta
            titulo="Recuento de competencia por nivel actual"
            subtitulo="Estudiantes en cada nivel de dominio"
          >
            <ColumnasApiladas datos={apiladas} alto={280} />
          </Tarjeta>
        </div>

        <Tarjeta
          titulo="Valores del período — sin seguimiento semanal"
          subtitulo="Estos indicadores no varían por semana; se muestran aparte para no simular una evolución"
        >
          <PanelSinSeguimiento
            indicadores={[
              { nombre: 'Índice de Logro de Resultados de Aprendizaje', valor: ilo.ilra },
              { nombre: 'Tasa de Logro por Competencia', valor: ilo.tlc },
              { nombre: 'Índice de Brecha de Aprendizaje', valor: ilo.iba, escala: 'Puntos' },
              { nombre: 'Nivel de Logro del Aprendizaje', valor: ilo.nla },
              { nombre: 'Tasa de Aceptación de Recomendaciones', valor: agente.tar },
              { nombre: 'Nivel de Recomendaciones Aplicadas', valor: agente.nra },
              { nombre: 'Tasa de Respuesta a Recomendaciones', valor: agente.trr },
              { nombre: 'Efectividad de la Intervención Adaptativa', valor: agente.eia, escala: 'Puntos' },
            ]}
          />
        </Tarjeta>

        <Tarjeta
          titulo="Recomendaciones"
          subtitulo="Ordenable por cualquier columna; el total de brecha suma todas las filas, no sólo la página"
        >
          <TablaRecomendaciones filas={recos} nombreEstudiante={nombreEstudiante} />
        </Tarjeta>
      </div>
    </Pagina>
  )
}
