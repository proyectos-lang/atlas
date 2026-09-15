import { exigirSesion } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { nombreDe, mostrarAvisoSemilla } from '@/lib/kpi/catalogo'
import { NIVELES } from '@/lib/kpi/escala'
import {
  COMPETENCIAS_EXPLICADAS,
  ETAPAS_EMBUDO,
  EXCEPCION_CPP,
  EXPLICACIONES,
  REGLAS,
  VALORES_REFERENCIA,
  explicacionDe,
  type ExplicacionIndicador,
} from '@/lib/kpi/metodologia'

export const metadata = { title: 'Acerca de los indicadores · ATLAS' }

/**
 * Cómo se calcula cada indicador.
 *
 * Dos niveles de lectura: la prosa queda visible para quien sólo necesita
 * saber qué mide el número; la fórmula, el origen y los parámetros se
 * despliegan para quien tenga que auditarlo o replicarlo.
 */

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-banda rounded-tarjeta border border-superficie-borde bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-institucional">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Etiqueta({ children, tono }: { children: string; tono: 'neutro' | 'aviso' }) {
  return (
    <span
      className={
        tono === 'aviso'
          ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900'
          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700'
      }
    >
      {children}
    </span>
  )
}

function FichaIndicador({ e }: { e: ExplicacionIndicador }) {
  const simulado = mostrarAvisoSemilla(e.codigo)

  return (
    <article className="border-t border-superficie-borde py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-medium text-slate-900">{nombreDe(e.codigo)}</h4>
        <div className="flex flex-wrap gap-1.5">
          {e.trunca && <Etiqueta tono="neutro">Se limita a 100</Etiqueta>}
          {e.prorratea && <Etiqueta tono="neutro">Se prorratea por semanas</Etiqueta>}
          {simulado && <Etiqueta tono="aviso">Pendiente de evaluación docente</Etiqueta>}
        </div>
      </div>

      {/* Nivel 1: qué mide, en una frase. */}
      <p className="mt-1.5 text-sm text-slate-700">{e.queMide}</p>

      {e.interpretacion && (
        <p className="mt-1.5 text-sm text-texto-secundario">
          <span className="font-medium text-slate-700">Cómo leerlo: </span>
          {e.interpretacion}
        </p>
      )}

      {e.advertencia && (
        <p className="mt-2 rounded-md border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {e.advertencia}
        </p>
      )}

      {/* Nivel 2: el detalle del cálculo, plegado. */}
      <details className="group mt-2">
        <summary className="cursor-pointer text-sm text-institucional underline underline-offset-2">
          Ver el cálculo
        </summary>
        <dl className="mt-2 space-y-2 rounded-md bg-institucional-suave px-4 py-3 text-sm">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-texto-secundario">
              Fórmula
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] leading-relaxed text-slate-800">
              {e.formula}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-texto-secundario">
              Origen del dato
            </dt>
            <dd className="mt-0.5 text-slate-800">{e.origen}</dd>
          </div>
          {e.parametro && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-texto-secundario">
                Parámetro configurable
              </dt>
              <dd className="mt-0.5 text-slate-800">
                {e.parametro.descripcion}: <strong>{e.parametro.valor}</strong>{' '}
                <span className="text-texto-secundario">({e.parametro.codigo})</span>
              </dd>
            </div>
          )}
        </dl>
      </details>
    </article>
  )
}

export default async function PaginaAcercaDe() {
  const { perfil } = await exigirSesion('/acerca-de')

  const indices = ['CTG', 'ITE', 'IAU', 'ICOM', 'IPC', 'IRP']
    .map(explicacionDe)
    .filter((e): e is ExplicacionIndicador => e !== undefined)

  const ilos = ['ILRA', 'TLC', 'IBA', 'NLA']
    .map(explicacionDe)
    .filter((e): e is ExplicacionIndicador => e !== undefined)

  const indice = [
    { id: 'lectura', texto: 'Cómo se lee un indicador' },
    { id: 'reglas', texto: 'Las cuatro reglas del cálculo' },
    { id: 'indices', texto: 'Los índices y la competencia global' },
    ...COMPETENCIAS_EXPLICADAS.map((c) => ({
      id: `c-${c.indice.toLowerCase()}`,
      texto: c.competencia,
    })),
    { id: 'ilos', texto: 'Resultados de aprendizaje' },
    { id: 'embudo', texto: 'El embudo de progresión' },
    { id: 'rubrica', texto: 'La rúbrica del docente' },
    { id: 'verificacion', texto: 'Cómo se verifica el motor' },
  ]

  return (
    <Marco perfil={perfil} titulo="Acerca de los indicadores">
      <div className="space-y-5 pb-10">
        <div className="rounded-tarjeta border border-superficie-borde bg-white p-6">
          <p className="max-w-3xl text-sm leading-relaxed text-slate-700">
            Esta página explica cómo se calcula cada número que aparece en ATLAS.
            El texto de cada indicador dice qué mide y cómo leerlo; la fórmula
            exacta, el origen del dato y los parámetros se despliegan en
            «Ver el cálculo», para quien deba auditarlo o reproducirlo.
          </p>

          <nav className="mt-4 flex flex-wrap gap-2">
            {indice.map((i) => (
              <a
                key={i.id}
                href={`#${i.id}`}
                className="rounded-full border border-superficie-borde px-3 py-1 text-xs
                           text-institucional transition hover:bg-institucional-suave"
              >
                {i.texto}
              </a>
            ))}
          </nav>
        </div>

        {/* ---------- Escala de dominio ---------- */}
        <Seccion id="lectura" titulo="Cómo se lee un indicador">
          <p className="max-w-3xl text-sm text-slate-700">
            Casi todos los indicadores van de 0 a 100 y se interpretan con la misma
            escala de dominio. El color es el mismo en toda la aplicación.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                  <th className="py-2 pr-3 font-medium">Nivel</th>
                  <th className="py-2 pr-3 font-medium">Rango</th>
                  <th className="py-2 font-medium">Meta siguiente</th>
                </tr>
              </thead>
              <tbody>
                {NIVELES.map((n) => (
                  <tr key={n.nivel} className="border-b border-superficie-borde/60">
                    <td className="py-2 pr-3">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: n.color, color: n.colorTexto }}
                      >
                        {n.nivel}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700">
                      {n.nivel === 'Excelente'
                        ? '90 a 100'
                        : `${n.minimo} a menos de ${Math.ceil(n.maximo)}`}
                    </td>
                    <td className="py-2 text-texto-secundario">
                      {n.metaSiguiente === null
                        ? 'Mantener el nivel'
                        : `Llegar a ${n.metaSiguiente}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-texto-secundario">
            Hay una excepción: el Índice de Brecha de Aprendizaje va en puntos y puede
            ser negativo. No se colorea con esta escala, porque un valor negativo
            significa que el estudiante supera lo esperado.
          </p>
        </Seccion>

        {/* ---------- Las cuatro reglas ---------- */}
        <Seccion id="reglas" titulo="Las cuatro reglas del cálculo">
          <p className="max-w-3xl text-sm text-slate-700">
            Estas cuatro reglas gobiernan todos los indicadores. No son detalles de
            implementación: cambiarlas cambia los resultados.
          </p>
          <ol className="mt-4 space-y-4">
            {REGLAS.map((r) => (
              <li key={r.numero} className="flex gap-3">
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center
                             rounded-full bg-institucional text-xs font-semibold text-white"
                >
                  {r.numero}
                </span>
                <div className="max-w-3xl">
                  <h3 className="text-sm font-semibold text-slate-900">{r.titulo}</h3>
                  <p className="mt-1 text-sm text-slate-700">{r.explicacion}</p>
                  <p className="mt-1 text-sm text-texto-secundario">
                    <span className="font-medium text-slate-700">Por qué importa: </span>
                    {r.porQue}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-3xl rounded-md border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-medium">Una excepción. </span>
            {EXCEPCION_CPP}
          </p>
        </Seccion>

        {/* ---------- Índices ---------- */}
        <Seccion id="indices" titulo="Los índices y la competencia global">
          <p className="max-w-3xl text-sm text-slate-700">
            Cada competencia se resume en un índice, que es el promedio simple de sus
            sub-indicadores. Los cinco índices se combinan en la Competencia Transversal
            Global, esta vez ponderada por los pesos que se configuran por curso.
          </p>
          <div className="mt-4">
            {indices.map((e) => (
              <FichaIndicador key={e.codigo} e={e} />
            ))}
          </div>
        </Seccion>

        {/* ---------- Una sección por competencia ---------- */}
        {COMPETENCIAS_EXPLICADAS.map((c) => (
          <Seccion
            key={c.indice}
            id={`c-${c.indice.toLowerCase()}`}
            titulo={c.competencia}
          >
            <p className="max-w-3xl text-sm text-slate-700">{c.descripcion}</p>
            <div className="mt-4">
              {c.subIndicadores
                .map(explicacionDe)
                .filter((e): e is ExplicacionIndicador => e !== undefined)
                .map((e) => (
                  <FichaIndicador key={e.codigo} e={e} />
                ))}
            </div>
          </Seccion>
        ))}

        {/* ---------- ILOs ---------- */}
        <Seccion id="ilos" titulo="Resultados de aprendizaje">
          <p className="max-w-3xl text-sm text-slate-700">
            Los resultados de aprendizaje (RA1 a RA5) se evalúan aparte de las
            competencias transversales y responden a otra pregunta: no cómo trabaja el
            estudiante, sino qué logró.
          </p>
          <div className="mt-4">
            {ilos.map((e) => (
              <FichaIndicador key={e.codigo} e={e} />
            ))}
          </div>
        </Seccion>

        {/* ---------- Embudo ---------- */}
        <Seccion id="embudo" titulo="El embudo de progresión">
          <p className="max-w-3xl text-sm text-slate-700">
            El embudo cuenta cuántos estudiantes superan cada etapa. Cada etapa es un
            criterio individual: se evalúa estudiante por estudiante, no sobre el
            promedio del grupo.
          </p>
          <ol className="mt-4 space-y-3">
            {ETAPAS_EMBUDO.map((e) => (
              <li
                key={e.etapa}
                className="rounded-md border border-superficie-borde/80 p-3"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-texto-secundario">
                    Etapa {e.etapa}
                  </span>
                  <h3 className="text-sm font-medium text-slate-900">{e.nombre}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-700">{e.criterio}</p>
                {e.nota && (
                  <p className="mt-1 text-sm text-texto-secundario">{e.nota}</p>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-3 max-w-3xl text-sm text-texto-secundario">
            El embudo no responde al filtro de semanas: sus etapas describen la
            trayectoria del curso completo.
          </p>
        </Seccion>

        {/* ---------- Rúbrica ---------- */}
        <Seccion id="rubrica" titulo="La rúbrica del docente">
          <p className="max-w-3xl text-sm text-slate-700">
            Seis indicadores no vienen de la plataforma sino de la evaluación del
            docente: los cuatro de Pensamiento Crítico y dos de Resolución de Problemas.
            Cada estudiante tiene una calificación por criterio y por semana.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-slate-700">
            La rúbrica se completa fila por fila: cuando el docente califica un criterio
            de un estudiante en una semana, esa calificación queda registrada y sustituye
            al valor de partida. No hace falta completarla entera de una vez, y lo ya
            calificado nunca se sobrescribe.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-slate-700">
            Mientras un criterio no haya sido calificado por el docente, el Índice de
            Pensamiento Crítico y el de Resolución de Problemas —y con ellos la
            Competencia Transversal Global— se apoyan en parte en el valor de partida.
            El agente de IA no fundamenta sus recomendaciones en esos criterios: se
            apoya en los indicadores con evaluación registrada.
          </p>
        </Seccion>

        {/* ---------- Verificación ---------- */}
        <Seccion id="verificacion" titulo="Cómo se verifica el motor">
          <p className="max-w-3xl text-sm text-slate-700">
            Las fórmulas están implementadas dos veces, de forma independiente: una en
            funciones de base de datos y otra como cálculo de referencia. Ambas se
            contrastan estudiante por estudiante, y además deben reproducir estas cifras
            sobre el conjunto completo sin filtros.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-superficie-borde text-left text-texto-secundario">
                  <th className="py-2 pr-3 font-medium">Indicador</th>
                  <th className="py-2 font-medium">Valor de referencia</th>
                </tr>
              </thead>
              <tbody>
                {VALORES_REFERENCIA.map((v) => (
                  <tr key={v.indicador} className="border-b border-superficie-borde/60">
                    <td className="py-2 pr-3 text-slate-700">{v.indicador}</td>
                    <td className="py-2 font-mono text-[13px] text-slate-900">{v.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-texto-secundario">
            Si las dos implementaciones coinciden y dan estos valores, el motor es
            correcto. Hoy la mayor diferencia entre ambas es 0,00000000.
          </p>
        </Seccion>

        <p className="px-1 text-xs text-texto-secundario">
          {EXPLICACIONES.length} indicadores documentados. La fuente de verdad del
          cálculo son las funciones de base de datos; esta página las transcribe.
        </p>
      </div>
    </Marco>
  )
}
