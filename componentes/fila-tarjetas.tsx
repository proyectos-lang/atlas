import { TarjetaConteo, TarjetaIndicador } from './graficos/base'
import type { Conteos } from '@/lib/kpi/consultas'

/**
 * Fila de nueve tarjetas institucionales (§8.1).
 * Borde superior de 3 px; las dos de índice van destacadas con borde azul
 * y fondo suave. Se pliega en dos filas bajo 1280 px y en columna en móvil.
 */
export function FilaTarjetas({
  conteos,
  ctg,
  ilra,
}: {
  conteos: Conteos
  ctg: number | null
  ilra: number | null
}) {
  const pieImplementadas =
    conteos.recomendacionesImplementadas === 0
      ? 'sin resultados aún'
      : `${Math.round(
          (100 * conteos.recomendacionesImplementadas) /
            Math.max(conteos.recomendacionesGeneradas, 1)
        )} % del total`

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9">
      <TarjetaConteo
        titulo="Cursos" conteo={conteos.cursos}
        pie={`en ${conteos.universidades} ${conteos.universidades === 1 ? 'universidad' : 'universidades'}`}
      />
      <TarjetaConteo
        titulo="Docentes" conteo={conteos.docentes}
        pie={conteos.docentes === 0 ? 'sin registros de docente' : 'registrados'}
        sinRegistros={conteos.docentes === 0}
      />
      <TarjetaConteo titulo="Estudiantes" conteo={conteos.estudiantes} pie="matriculados" />
      <TarjetaConteo titulo="Actividades" conteo={conteos.actividades} pie="evaluables" />
      <TarjetaConteo titulo="Resultados de aprendizaje" conteo={conteos.ilos} pie="ILOs definidos" />

      {/* Las dos destacadas. CTG hereda la advertencia de dato semilla
          porque incluye Pensamiento Crítico y Resolución de Problemas. */}
      <TarjetaIndicador
        titulo="Competencia transversal global" valor={ctg}
        pie="promedio del ámbito" destacada badge codigoKpi="CTG"
      />
      <TarjetaIndicador
        titulo="Índice institucional de logro de ILOs" valor={ilra}
        pie="promedio del ámbito" destacada badge
      />

      <TarjetaConteo
        titulo="Recomendaciones generadas" conteo={conteos.recomendacionesGeneradas}
        pie="por el asistente"
      />
      <TarjetaConteo
        titulo="Recomendaciones implementadas" conteo={conteos.recomendacionesImplementadas}
        pie={pieImplementadas}
        sinRegistros={conteos.recomendacionesImplementadas === 0}
      />
    </div>
  )
}

/**
 * Aviso de datos semilla (§11.2).
 * Visible en las páginas del Asesor y del Docente cuando el ámbito incluye
 * indicadores calculados sobre la rúbrica simulada. No se esconde en un menú.
 */
export function AvisoDatosSemilla() {
  return (
    <div className="rounded-tarjeta border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="flex items-start gap-2 text-xs text-amber-900">
        <span
          className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center
                     rounded-full bg-amber-200 text-[10px] font-bold text-amber-900"
          aria-hidden
        >
          !
        </span>
        <span>
          <strong className="font-semibold">Este ámbito incluye datos simulados.</strong>{' '}
          El Índice de Pensamiento Crítico y el de Resolución de Problemas se calculan
          en parte sobre una rúbrica generada, no sobre la evaluación real del docente.
          Los indicadores afectados llevan un ícono de advertencia. Reemplazar por la
          calificación del docente desde la pantalla de rúbrica.
        </span>
      </p>
    </div>
  )
}

/**
 * Panel de indicadores del período que no admiten seguimiento semanal (§6.5).
 * Van aquí y no dentro de un gráfico de evolución: una línea recta en un
 * gráfico titulado "evolución" afirmaría un cambio que no se midió.
 */
export function PanelSinSeguimiento({
  indicadores,
}: {
  indicadores: { nombre: string; valor: number | null; escala?: 'Porcentaje' | 'Puntos'; codigoKpi?: string }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {indicadores.map((i) => (
        <TarjetaIndicador
          key={i.nombre}
          titulo={i.nombre}
          valor={i.valor}
          pie="valor del período"
          escala={i.escala ?? 'Porcentaje'}
          codigoKpi={i.codigoKpi}
        />
      ))}
    </div>
  )
}
