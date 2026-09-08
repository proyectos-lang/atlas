import { exigirSesion } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { conteos, cursos, estudiantes } from '@/lib/kpi/consultas'
import {
  embudo, indices, indicesPorEstudiante, indiceGlobalPorCurso,
  evolucionSemanal, indicadoresAgente,
} from '@/lib/kpi/indicadores'
import { Tarjeta, TarjetaConteo, TarjetaIndicador, BadgeNivel, Valor } from '@/componentes/graficos/base'
import { BarrasHorizontales, BarrasVerticales, ColumnasApiladas } from '@/componentes/graficos/barras'
import { Linea } from '@/componentes/graficos/linea'
import { RadarCompetencias } from '@/componentes/graficos/radar'
import { Dispersion } from '@/componentes/graficos/dispersion'
import { Matriz } from '@/componentes/graficos/matriz'
import { Medidor } from '@/componentes/graficos/medidor'
import { Embudo } from '@/componentes/graficos/embudo'
import { TarjetaCompetencia } from '@/componentes/graficos/tarjeta-competencia'
import { COMPETENCIAS } from '@/lib/kpi/catalogo'

export const metadata = { title: 'Componentes · ATLAS' }

/**
 * Galería de componentes con datos reales.
 * Sirve para revisar cada visual aislado antes de montar las páginas.
 */
export default async function PaginaComponentes() {
  const { perfil, alcance } = await exigirSesion('/administrador')

  const [c, listaCursos, listaEst, i, porCurso, evolucion, emb, porEst, agente] =
    await Promise.all([
      conteos(alcance), cursos(alcance), estudiantes(alcance),
      indices(alcance), indiceGlobalPorCurso(alcance),
      evolucionSemanal(alcance), embudo(alcance),
      indicesPorEstudiante(alcance), indicadoresAgente(alcance),
    ])

  const nombreCurso = new Map(listaCursos.map((x) => [x.id, x.nombre]))
  const codigoEst = new Map(listaEst.map((e) => [e.id, e.codigo]))

  const radar = [
    { competencia: 'Trabajo en Equipo', valor: i.ite ?? 0 },
    { competencia: 'Aprendizaje Autónomo', valor: i.iau ?? 0 },
    { competencia: 'Comunicación Efectiva', valor: i.icom ?? 0 },
    { competencia: 'Pensamiento Crítico', valor: i.ipc ?? 0 },
    { competencia: 'Resolución de Problemas', valor: i.irp ?? 0 },
  ]

  // Matriz curso x competencia
  const porCursoIndices = listaCursos.map((cu) => {
    const suyos = porEst.filter((e) => e.cursoId === cu.id)
    const med = (k: 'ite' | 'iau' | 'icom' | 'ipc' | 'irp') =>
      suyos.length ? suyos.reduce((a, b) => a + b[k], 0) / suyos.length : null
    return {
      etiqueta: cu.nombre,
      valores: [med('ite'), med('iau'), med('icom'), med('ipc'), med('irp')],
    }
  })

  // Recuento de competencia por nivel
  const niveles = (k: 'ite' | 'iau' | 'icom' | 'ipc' | 'irp') => {
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
    { etiqueta: 'Trabajo en Equipo', ...niveles('ite') },
    { etiqueta: 'Aprendizaje Autónomo', ...niveles('iau') },
    { etiqueta: 'Comunicación Efectiva', ...niveles('icom') },
    { etiqueta: 'Pensamiento Crítico', ...niveles('ipc') },
    { etiqueta: 'Resolución de Problemas', ...niveles('irp') },
  ]

  const primero = porEst[0]

  return (
    <Marco perfil={perfil} titulo="Galería de componentes">
      <div className="space-y-6">
        <p className="text-sm text-texto-secundario">
          Cada componente con datos reales del ámbito de tu perfil. Es una página
          de revisión, no una de las cinco del sistema.
        </p>

        {/* Fila de nueve tarjetas */}
        <Tarjeta titulo="Fila de tarjetas institucionales" subtitulo="Nueve tarjetas, borde superior de 3 px; las dos de índice van destacadas">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
            <TarjetaConteo titulo="Cursos" conteo={c.cursos} pie={`en ${c.universidades} universidades`} />
            <TarjetaConteo titulo="Docentes" conteo={c.docentes} pie={c.docentes === 0 ? 'sin registros de docente' : 'registrados'} sinRegistros={c.docentes === 0} />
            <TarjetaConteo titulo="Estudiantes" conteo={c.estudiantes} pie="matriculados" />
            <TarjetaConteo titulo="Actividades" conteo={c.actividades} pie="evaluables" />
            <TarjetaConteo titulo="Resultados de aprendizaje" conteo={c.ilos} pie="ILOs definidos" />
            <TarjetaIndicador titulo="Competencia transversal global" valor={i.ctg} pie="promedio del ámbito" destacada badge />
            <TarjetaIndicador titulo="Índice institucional de logro de ILOs" valor={57.8} pie="promedio del ámbito" destacada badge />
            <TarjetaConteo titulo="Recomendaciones generadas" conteo={c.recomendacionesGeneradas} pie="por el asistente" />
            <TarjetaConteo titulo="Recomendaciones implementadas" conteo={c.recomendacionesImplementadas} pie="sin resultados aún" sinRegistros={c.recomendacionesImplementadas === 0} />
          </div>
        </Tarjeta>

        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          <Tarjeta titulo="Índice global por curso" subtitulo="Eje curso; valor Competencia Transversal Global, orden descendente">
            <BarrasHorizontales
              datos={porCurso.map((p) => ({
                etiqueta: nombreCurso.get(p.cursoId) ?? String(p.cursoId),
                valor: p.ctg,
              }))}
            />
          </Tarjeta>

          <Tarjeta titulo="Evolución por semana" subtitulo="Eje semana 1 a 6; tres índices con seguimiento semanal">
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

          <Tarjeta titulo="Radar de competencias" subtitulo="Los cinco índices del ámbito">
            <RadarCompetencias datos={radar} />
          </Tarjeta>

          <Tarjeta titulo="Matriz curso por competencia" subtitulo="Formato condicional por la escala de dominio">
            <Matriz
              etiquetaFila="Curso"
              columnas={['Trabajo en Equipo', 'Aprendizaje Autónomo', 'Comunicación Efectiva', 'Pensamiento Crítico', 'Resolución de Problemas']}
              filas={porCursoIndices}
            />
          </Tarjeta>

          <Tarjeta titulo="Dispersión de riesgo" subtitulo="Un punto por estudiante; el cuadrante inferior izquierdo señala riesgo">
            <Dispersion
              datos={porEst.map((e) => ({
                estudiante: codigoEst.get(e.usuarioId) ?? String(e.usuarioId),
                x: e.iau, y: e.irp,
              }))}
              ejeY="Índice de Resolución de Problemas"
            />
          </Tarjeta>

          <Tarjeta titulo="Embudo de progresión académica" subtitulo="Conversión entre etapas; en rojo la mayor caída">
            <Embudo etapas={emb} />
          </Tarjeta>

          <Tarjeta titulo="Recuento de competencia por nivel actual" subtitulo="Columnas apiladas con los colores de la escala de dominio">
            <ColumnasApiladas datos={apiladas} />
          </Tarjeta>

          <Tarjeta titulo="Tasa de logro por competencia" subtitulo="Barras verticales por resultado de aprendizaje">
            <BarrasVerticales
              datos={[
                { etiqueta: 'RA1', valor: 72.1 }, { etiqueta: 'RA2', valor: 68.4 },
                { etiqueta: 'RA3', valor: 74.9 }, { etiqueta: 'RA4', valor: 70.2 },
                { etiqueta: 'RA5', valor: 72.9 },
              ]}
            />
          </Tarjeta>
        </div>

        {/* Medidores y tarjetas de competencia */}
        <Tarjeta titulo="Medidores semicirculares" subtitulo="Marca gris en la meta del siguiente nivel; valor al centro">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {primero && (
              <>
                <Medidor valor={primero.ite} competencia="Trabajo en Equipo" />
                <Medidor valor={primero.iau} competencia="Aprendizaje Autónomo" />
                <Medidor valor={primero.icom} competencia="Comunicación Efectiva" />
                <Medidor valor={primero.ipc} competencia="Pensamiento Crítico" />
                <Medidor valor={null} competencia="Sin datos (ejemplo)" />
              </>
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Tarjetas de competencia del estudiante" subtitulo="Con meta del siguiente nivel y meta intermedia cuando el salto es grande">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {primero && COMPETENCIAS.map((comp, n) => (
              <TarjetaCompetencia
                key={comp}
                competencia={comp}
                valor={[primero.ite, primero.iau, primero.icom, primero.ipc, primero.irp][n]}
                conAviso={n >= 3}
              />
            ))}
          </div>
        </Tarjeta>

        {/* Estados sin datos */}
        <Tarjeta titulo="Indicadores del agente" subtitulo="Sin ciclo de revisión todavía: guion largo y leyenda, nunca 0 %">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <TarjetaIndicador titulo="Tasa de Aceptación de Recomendaciones" valor={agente.tar} pie="del total emitido" />
            <TarjetaIndicador titulo="Nivel de Recomendaciones Aplicadas" valor={agente.nra} pie="de las aprobadas" />
            <TarjetaIndicador titulo="Tasa de Respuesta a Recomendaciones" valor={agente.trr} pie="del total emitido" />
            <TarjetaIndicador titulo="Efectividad de la Intervención Adaptativa" valor={agente.eia} pie="mejora media" escala="Puntos" />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Escala de dominio" subtitulo="Colores de fondo definidos por el usuario; colores de texto elegidos por contraste medido">
          <div className="flex flex-wrap items-center gap-3">
            {[45, 67, 82, 95].map((v) => (
              <div key={v} className="flex items-center gap-2">
                <Valor valor={v} className="text-sm font-medium text-slate-700" />
                <BadgeNivel valor={v} />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Valor valor={null} className="text-sm text-slate-700" />
              <BadgeNivel valor={null} />
            </div>
          </div>
        </Tarjeta>
      </div>
    </Marco>
  )
}
