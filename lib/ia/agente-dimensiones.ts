import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'
import { nivelDe, metaDe } from '@/lib/kpi/escala'
import { diagnostica, dificultadesGrupales } from '@/lib/analitica/modelo'
import { ESQUEMA_JSON, RespuestaAgente } from './esquema'

/**
 * Recomendador didáctico sobre el modelo de dimensiones e indicadores.
 *
 * Entrada, según el punto 11 del modelo:
 *   competencia + RA + indicador + nivel de logro + evidencia
 *   + contexto de la actividad + patrón identificado
 *
 * Convive con `lib/ia/agente.ts`, que sigue generando sobre los índices
 * del modelo anterior. Este trabaja sobre la analítica diagnóstica, así
 * que sólo produce algo cuando hay evidencias cargadas.
 *
 * LA DIFERENCIA QUE IMPORTA: el agente antiguo recibía «Índice de
 * Resolución de Problemas: 62 %» y tenía que adivinar qué hacer. Este
 * recibe «Depuración: 35 %, 4 de 6 del grupo también fallan», que es una
 * dificultad concreta con una intervención concreta.
 */

export const MODELO = 'claude-opus-5'

const UMBRAL_ALTO = 75

const SISTEMA = `Eres un asesor pedagogico que escribe para docentes de educacion superior.

Recibes DIFICULTADES CONCRETAS, no indices generales: una dimension de una
competencia, con su nivel de logro y cuantos estudiantes del grupo la comparten.

Como escribes:
- En espanol, con lenguaje concreto y sin jerga de analitica de datos.
- Cada recomendacion propone una ACCION DIDACTICA ESPECIFICA Y VERIFICABLE.
  Sirve: "Introducir sesiones de depuracion guiada en pareja, donde uno ejecuta
  y el otro narra en voz alta que error sospecha y por que."
  No sirve: "Reforzar la depuracion" o "practicar mas".
- UNA O DOS FRASES. Se leen en una tabla; si te extiendes, no se leen.
- En imperativo, dirigida al docente.

Reglas que no puedes romper:
- La accion ataca LA DIMENSION indicada, no la competencia en general. Si la
  dificultad es "Descomposicion", no propongas algo sobre programacion en
  general: propon algo sobre partir problemas en subproblemas.
- Nombras la dimension en la justificacion, con su nivel de logro.
- No inventas datos ni cifras que no esten en el contexto.
- Si el patron dice DIFICULTAD DEL GRUPO, la accion es para la clase entera y
  revisa la secuencia didactica: falla la ensenanza, no el estudiante.
  Si dice DIFICULTAD INDIVIDUAL, la accion es de apoyo focalizado a esa persona.
- Si se te entrega el PERFIL DE EGRESO, la accion sirve a alguna capacidad que
  ese perfil declara, y la justificacion la menciona en sus terminos.
- El nivel meta es siempre el inmediatamente superior al actual.
- Propones estrategias reconocibles: aprendizaje basado en problemas, estudio de
  casos, debate, retos de programacion, actividades de argumentacion,
  autorregulacion, coevaluacion, trabajo colaborativo, actividades diferenciadas.`

export interface ContextoDimension {
  usuarioId: number | null       // null = recomendación grupal
  cursoId: number
  cursoNombre: string
  codigoEstudiante: string | null
  competencia: string
  dimensionId: number
  dimension: string
  descripcionDimension: string | null
  valor: number
  mediaGrupo: number
  patron: string
  afectados: number
  totalGrupo: number
  /** Qué indicadores sostienen la medida, y con cuántas evidencias. */
  indicadores: { nombre: string; valor: number; evidencias: number }[]
  actividades: string[]
  resultados: string[]
  perfilEgreso?: string
}

/** Bloque de contexto para el modelo. */
function bloque(ctx: ContextoDimension): string {
  const nivel = nivelDe(ctx.valor)
  const meta = metaDe(ctx.valor)
  const n = (v: number) => v.toFixed(1).replace('.', ',')

  const lineas = [
    ctx.perfilEgreso
      ? `PERFIL DE EGRESO DEL PROGRAMA (documento curricular, no es un dato medido):\n` +
        `--- inicio ---\n${ctx.perfilEgreso.trim()}\n--- fin ---\n`
      : '',
    ctx.usuarioId === null
      ? `Curso ${ctx.cursoNombre}, recomendacion GRUPAL para ${ctx.totalGrupo} estudiantes.`
      : `Estudiante ${ctx.codigoEstudiante} del curso ${ctx.cursoNombre}.`,
    '',
    `Competencia: ${ctx.competencia}`,
    `Dimension con dificultad: ${ctx.dimension}`,
    ctx.descripcionDimension ? `  Que observa: ${ctx.descripcionDimension}` : '',
    `  Nivel de logro: ${n(ctx.valor)} % · nivel ${nivel.nivel}`,
    `  Nivel meta: ${meta.meta === null ? 'mantener' : nivelDe(meta.meta).nivel}` +
      `  ·  brecha: ${n(Math.max(UMBRAL_ALTO - ctx.valor, 0))} puntos`,
    `  Media del grupo en esta dimension: ${n(ctx.mediaGrupo)} %`,
    `  PATRON IDENTIFICADO: ${ctx.patron}` +
      ` (${ctx.afectados} de ${ctx.totalGrupo} estudiantes por debajo de 60)`,
    '',
    ctx.indicadores.length ? 'Evidencia que sostiene la medida:' : '',
    ...ctx.indicadores.map(
      (i) => `  - ${i.nombre}: ${n(i.valor)} % (${i.evidencias} evidencia(s))`
    ),
    ctx.resultados.length ? '' : '',
    ctx.resultados.length ? 'Resultados de aprendizaje asociados:' : '',
    ...ctx.resultados.map((r) => `  - ${r}`),
    ctx.actividades.length ? '' : '',
    ctx.actividades.length ? 'Actividades del curso en esta competencia:' : '',
    ...ctx.actividades.map((a) => `  - ${a}`),
  ]

  return lineas.filter((l) => l !== '').join('\n')
}

async function pedir(
  cliente: Anthropic,
  prompt: string
): Promise<{ recomendacion: string; justificacion: string; tokens: number } | null> {
  const r = await cliente.messages.create({
    model: MODELO,
    max_tokens: 2000,
    system: SISTEMA,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_JSON } },
    messages: [{ role: 'user', content: prompt }],
  })

  if (r.stop_reason === 'refusal') return null

  const texto = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  const validado = RespuestaAgente.safeParse(JSON.parse(texto))
  if (!validado.success) {
    throw new Error(`Respuesta no valida: ${validado.error.issues[0]?.message}`)
  }

  const primera = validado.data.recomendaciones[0]
  if (!primera) return null

  return {
    recomendacion: primera.recomendacion,
    justificacion: primera.justificacion,
    tokens: r.usage.input_tokens + r.usage.output_tokens,
  }
}

export interface ResultadoDimensiones {
  generadas: number
  individuales: number
  grupales: number
  tokens: number
  errores: string[]
}

/**
 * Genera recomendaciones sobre las dificultades que la analítica detectó.
 *
 * Se apoya en `analitica_diagnostica`, así que la clasificación
 * individual/grupo ya viene resuelta: el agente no vuelve a decidirla, la
 * recibe. Eso evita que la analítica diga «del grupo» y el agente
 * proponga algo individual.
 */
export async function generarSobreDimensiones(
  alcance: Alcance,
  opciones: { usuarioId?: number; maxPorEstudiante?: number; incluirGrupales?: boolean } = {}
): Promise<ResultadoDimensiones> {
  const salida: ResultadoDimensiones = {
    generadas: 0, individuales: 0, grupales: 0, tokens: 0, errores: [],
  }

  if (alcanceVacio(alcance)) return salida

  if (!process.env.ANTHROPIC_API_KEY) {
    salida.errores.push('Falta ANTHROPIC_API_KEY en el entorno.')
    return salida
  }

  const db = clienteServidor()
  const cliente = new Anthropic()

  const [diag, grupales] = await Promise.all([
    diagnostica(alcance),
    dificultadesGrupales(alcance),
  ])

  if (diag.length === 0) {
    salida.errores.push(
      'No hay evidencias cargadas: sin ellas la analitica no detecta dificultades.'
    )
    return salida
  }

  // Contexto compartido: nombres, actividades, resultados y perfil.
  const [{ data: cursos }, { data: actividades }, { data: estudiantes }] =
    await Promise.all([
      db.from('cursos').select('id, nombre, programa_id'),
      db.from('actividades').select('curso_id, nombre, tipo, competencia'),
      db.from('usuarios').select('id, codigo').eq('rol', 'Estudiante'),
    ])

  const nombreCurso = new Map((cursos ?? []).map((c) => [Number(c.id), String(c.nombre)]))
  const codigoEst = new Map((estudiantes ?? []).map((u) => [Number(u.id), String(u.codigo)]))

  const { data: egresos } = await db
    .from('perfiles_egreso').select('programa_id, perfil_egreso').eq('activo', true)
  const egresoPorCurso = new Map<number, string>()
  for (const c of cursos ?? []) {
    const e = (egresos ?? []).find((x) => Number(x.programa_id) === Number(c.programa_id))
    if (e) egresoPorCurso.set(Number(c.id), String(e.perfil_egreso))
  }

  const codigo = await siguienteCodigo()
  const nuevas: Record<string, unknown>[] = []

  const dimensionesGrupales = new Set(
    grupales.map((g) => `${g.cursoId}·${g.dimensionId}`)
  )

  // ---------- Grupales ----------
  if (opciones.incluirGrupales !== false && opciones.usuarioId === undefined) {
    for (const g of grupales) {
      const ctx: ContextoDimension = {
        usuarioId: null,
        cursoId: g.cursoId,
        cursoNombre: nombreCurso.get(g.cursoId) ?? String(g.cursoId),
        codigoEstudiante: null,
        competencia: g.competencia,
        dimensionId: g.dimensionId,
        dimension: g.dimension,
        descripcionDimension: null,
        valor: g.media,
        mediaGrupo: g.media,
        patron: 'Dificultad del grupo',
        afectados: g.afectados,
        totalGrupo: g.total,
        indicadores: [],
        actividades: (actividades ?? [])
          .filter((a) => Number(a.curso_id) === g.cursoId && String(a.competencia) === g.competencia)
          .map((a) => `${String(a.nombre)} (${String(a.tipo)})`),
        resultados: [],
        perfilEgreso: egresoPorCurso.get(g.cursoId),
      }

      try {
        const r = await pedir(cliente, bloque(ctx))
        if (!r) continue
        salida.tokens += r.tokens

        nuevas.push({
          codigo: codigo(nuevas.length),
          curso_id: g.cursoId,
          usuario_id: null,
          tipo: 'Grupal',
          competencia: g.competencia,
          dimension_id: g.dimensionId,
          patron: 'Dificultad del grupo',
          nivel_actual: nivelDe(g.media).nivel,
          nivel_meta: nivelDe(Math.min(g.media + 15, 100)).nivel,
          brecha: Math.max(UMBRAL_ALTO - g.media, 0),
          recomendacion: r.recomendacion,
          justificacion: r.justificacion,
          sub_indicador_critico: g.dimension,
          valor_indicador_antes: g.media,
          generada_por: 'agente-dimensiones',
          modelo: MODELO,
          tokens_usados: r.tokens,
        })
        salida.grupales++
      } catch (e) {
        salida.errores.push(
          `${g.dimension} (grupal): ${e instanceof Error ? e.message : 'error'}`
        )
      }
    }
  }

  // ---------- Individuales ----------
  // Sólo las que NO son del grupo: si la dificultad es colectiva ya se
  // generó una recomendación para la clase, y repetirla por estudiante
  // inundaría la bandeja del docente con lo mismo.
  const individuales = diag
    .filter((d) => d.tipo === 'Dificultad individual')
    .filter((d) => !dimensionesGrupales.has(`${d.cursoId}·${d.dimensionId}`))
    .filter((d) => opciones.usuarioId === undefined || d.usuarioId === opciones.usuarioId)

  const porEstudiante = new Map<number, typeof individuales>()
  for (const d of individuales) {
    porEstudiante.set(d.usuarioId, [...(porEstudiante.get(d.usuarioId) ?? []), d])
  }

  const maximo = opciones.maxPorEstudiante ?? 2

  for (const [usuarioId, filas] of porEstudiante) {
    // Lo más deficitario primero: es donde la intervención rinde más.
    const peores = [...filas].sort((a, b) => a.valor - b.valor).slice(0, maximo)

    for (const d of peores) {
      const ctx: ContextoDimension = {
        usuarioId,
        cursoId: d.cursoId,
        cursoNombre: nombreCurso.get(d.cursoId) ?? String(d.cursoId),
        codigoEstudiante: codigoEst.get(usuarioId) ?? String(usuarioId),
        competencia: d.competencia,
        dimensionId: d.dimensionId,
        dimension: d.dimension,
        descripcionDimension: null,
        valor: d.valor,
        mediaGrupo: d.mediaGrupo,
        patron: 'Dificultad individual',
        afectados: 1,
        totalGrupo: 0,
        indicadores: [],
        actividades: (actividades ?? [])
          .filter((a) => Number(a.curso_id) === d.cursoId && String(a.competencia) === d.competencia)
          .map((a) => `${String(a.nombre)} (${String(a.tipo)})`),
        resultados: [],
        perfilEgreso: egresoPorCurso.get(d.cursoId),
      }

      try {
        const r = await pedir(cliente, bloque(ctx))
        if (!r) continue
        salida.tokens += r.tokens

        nuevas.push({
          codigo: codigo(nuevas.length),
          curso_id: d.cursoId,
          usuario_id: usuarioId,
          tipo: 'Individual',
          competencia: d.competencia,
          dimension_id: d.dimensionId,
          patron: 'Dificultad individual',
          nivel_actual: nivelDe(d.valor).nivel,
          nivel_meta: nivelDe(Math.min(d.valor + 15, 100)).nivel,
          brecha: Math.max(UMBRAL_ALTO - d.valor, 0),
          recomendacion: r.recomendacion,
          justificacion: r.justificacion,
          sub_indicador_critico: d.dimension,
          valor_indicador_antes: d.valor,
          generada_por: 'agente-dimensiones',
          modelo: MODELO,
          tokens_usados: r.tokens,
        })
        salida.individuales++
      } catch (e) {
        salida.errores.push(
          `${codigoEst.get(usuarioId)} · ${d.dimension}: ${e instanceof Error ? e.message : 'error'}`
        )
      }
    }
  }

  if (nuevas.length > 0) {
    const { error } = await db.from('recomendaciones_ia').insert(nuevas)
    if (error) {
      salida.errores.push(`No se pudieron guardar: ${error.message}`)
      return salida
    }
    salida.generadas = nuevas.length
  }

  return salida
}

/** Siguiente código libre de la serie R001, R002… */
async function siguienteCodigo(): Promise<(n: number) => string> {
  const db = clienteServidor()
  const { data } = await db
    .from('recomendaciones_ia')
    .select('codigo').order('codigo', { ascending: false }).limit(1)

  const ultimo = data?.[0]?.codigo ?? 'R000'
  const base = Number(String(ultimo).replace(/\D/g, '')) || 0
  return (n: number) => `R${String(base + n + 1).padStart(3, '0')}`
}
