import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'
import { nivelDe, metaDe } from '@/lib/kpi/escala'
import { esSemilla, nombreDe, INDICE_DE_COMPETENCIA } from '@/lib/kpi/catalogo'
import { ESQUEMA_JSON, RespuestaAgente, type RecomendacionIA } from './esquema'

/**
 * Agente de recomendaciones pedagógicas.
 *
 * Genera recomendaciones a partir de los indicadores ya calculados y las
 * persiste en atlas.recomendaciones_ia con estado 'Pendiente de revisión
 * docente'. Nunca se aplican solas: el docente revisa.
 */

export const MODELO = 'claude-opus-5'

/** Sub-indicadores que componen cada competencia, por código. */
const SUB_INDICADORES: Record<string, string[]> = {
  'Trabajo en Equipo': ['ICOL', 'TPI', 'RIP', 'NCG', 'TA'],
  'Aprendizaje Autónomo': ['FA', 'TE', 'UPR', 'CPP', 'TPS'],
  'Comunicación Efectiva': ['CLT', 'NPA', 'CID', 'CRF'],
  'Pensamiento Crítico': ['NA', 'NS', 'EA', 'TD'],
  'Resolución de Problemas': ['NIA', 'TRA', 'UEA', 'DPA'],
}

const UMBRAL_ALTO = 75
const UMBRAL_GRUPAL = 0.4   // más del 40 % del curso bajo Alto

const SISTEMA = `Eres un asesor pedagógico que escribe para docentes de educación superior.

Cómo escribes:
- En español, con lenguaje concreto y sin jerga de analítica de datos.
- Cada recomendación propone una ACCIÓN PEDAGÓGICA ESPECÍFICA Y VERIFICABLE, no un consejo genérico.
  Sirve: "Realizar un debate argumentativo con retroalimentación entre pares al cierre de cada unidad."
  No sirve: "Mejorar la comunicación" o "reforzar los contenidos".
- UNA O DOS FRASES por recomendación. Se leen en una tabla; si te extiendes, no se leen.
- En imperativo, dirigida al docente, no al estudiante.

Reglas que no puedes romper:
- Te apoyas en el sub-indicador con peor desempeño dentro de la competencia y lo nombras en la justificación.
- No inventas datos ni citas cifras que no estén en el contexto que se te entrega.
- Si un indicador viene marcado como DATO SIMULADO, no fundamentas la recomendación en él:
  usa otro sub-indicador de la misma competencia que sí tenga datos reales, y si no lo hay,
  apóyate en el índice general sin citar el sub-indicador simulado.
- El nivel meta es siempre el nivel inmediatamente superior al actual.
- Si se te entrega el PERFIL DE EGRESO del programa, la accion que propongas debe servir a
  alguna de las capacidades que ese perfil declara, y la justificacion la menciona en los
  terminos del propio perfil. El perfil orienta el QUE se busca formar; los indicadores dicen
  DONDE esta la carencia. No cites el perfil de egreso como si fuera un dato medido.`

export interface ContextoEstudiante {
  usuarioId: number
  codigo: string
  cursoId: number
  cursoNombre: string
  indices: Record<string, number>
  subIndicadores: Record<string, number>
  actividades: { nombre: string; tipo: string; competencia: string }[]
  /** Perfil de egreso del programa, si el administrador lo configuro y esta activo. */
  perfilEgreso?: string
  /** Notas de analisis que acompanan al perfil de egreso. */
  notasEgreso?: string
}

/** Competencias bajo Alto, ordenadas por brecha descendente. */
export function competenciasConBrecha(indices: Record<string, number>) {
  return Object.entries(INDICE_DE_COMPETENCIA)
    .map(([competencia, codigo]) => ({
      competencia,
      codigo,
      valor: indices[codigo] ?? 0,
      brecha: UMBRAL_ALTO - (indices[codigo] ?? 0),
    }))
    .filter((c) => c.valor < UMBRAL_ALTO)
    .sort((a, b) => b.brecha - a.brecha)
}

/** Arma el texto de contexto para una competencia concreta. */
function bloqueCompetencia(
  ctx: ContextoEstudiante,
  competencia: string,
  codigoIndice: string
): string {
  const valor = ctx.indices[codigoIndice] ?? 0
  const nivel = nivelDe(valor)
  const meta = metaDe(valor)

  const subs = (SUB_INDICADORES[competencia] ?? [])
    .map((cod) => ({
      cod,
      nombre: nombreDe(cod),
      valor: ctx.subIndicadores[cod],
      simulado: esSemilla(cod),
    }))
    .filter((s) => Number.isFinite(s.valor))
    .sort((a, b) => a.valor - b.valor)

  const lineas = subs.map(
    (s) =>
      `    - ${s.nombre} (${s.cod}): ${s.valor.toFixed(1).replace('.', ',')} %` +
      (s.simulado ? '   [DATO SIMULADO: no fundamentes la recomendación en este]' : '')
  )

  const actividades = ctx.actividades
    .filter((a) => a.competencia === competencia)
    .map((a) => `    - ${a.nombre} (${a.tipo})`)

  return [
    `  Competencia: ${competencia}`,
    `    Índice actual: ${valor.toFixed(1).replace('.', ',')} % · nivel ${nivel.nivel}`,
    `    Nivel meta: ${meta.meta === null ? 'mantener' : nivelDe(meta.meta).nivel}` +
      `  ·  brecha: ${Math.max(UMBRAL_ALTO - valor, 0).toFixed(1).replace('.', ',')} puntos`,
    '    Sub-indicadores, de peor a mejor:',
    ...lineas,
    actividades.length ? '    Actividades del curso en esta competencia:' : '',
    ...actividades,
  ].filter(Boolean).join('\n')
}

/**
 * Bloque de perfil de egreso para el prompt. Vacio si el programa no lo
 * tiene configurado: el agente sigue trabajando solo con los indicadores.
 *
 * Va delimitado y rotulado como documento curricular para que el modelo no
 * lo confunda con una medicion ni cite de el cifras que no existen.
 */
function bloqueEgreso(ctx: ContextoEstudiante): string {
  if (!ctx.perfilEgreso) return ''
  const lineas = [
    'PERFIL DE EGRESO DEL PROGRAMA (documento curricular, no es un dato medido):',
    '--- inicio del perfil de egreso ---',
    ctx.perfilEgreso.trim(),
    '--- fin del perfil de egreso ---',
    ctx.notasEgreso ? `Notas para el analisis: ${ctx.notasEgreso.trim()}` : '',
  ].filter(Boolean)

  // El salto final separa el bloque de lo que viene después. Va fuera del
  // filter: una cadena vacía dentro se descartaría y el perfil quedaría
  // pegado a la línea del estudiante.
  return `${lineas.join('\n')}\n\n`
}

function nivelMetaDe(valor: number): string {
  const m = metaDe(valor)
  return m.meta === null ? 'Excelente' : nivelDe(m.meta).nivel
}

/** Llama al modelo y devuelve las recomendaciones ya validadas. */
async function pedirRecomendaciones(
  cliente: Anthropic,
  prompt: string
): Promise<{ recomendaciones: RecomendacionIA[]; tokens: number }> {
  const r = await cliente.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system: SISTEMA,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_JSON } },
    messages: [{ role: 'user', content: prompt }],
  })

  if (r.stop_reason === 'refusal') {
    throw new Error('El modelo declinó la solicitud.')
  }

  const texto = r.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // La API ya valida la forma contra el esquema; Zod valida el contenido.
  const validado = RespuestaAgente.safeParse(JSON.parse(texto))
  if (!validado.success) {
    throw new Error(`Respuesta no válida: ${validado.error.issues[0]?.message}`)
  }

  return {
    recomendaciones: validado.data.recomendaciones,
    tokens: r.usage.input_tokens + r.usage.output_tokens,
  }
}

/** Siguiente código libre de la serie R001, R002... */
async function siguienteCodigo(): Promise<(n: number) => string> {
  const db = clienteServidor()
  const { data } = await db
    .from('recomendaciones_ia').select('codigo').order('codigo', { ascending: false }).limit(1)
  const ultimo = data?.[0]?.codigo ?? 'R000'
  const base = Number(String(ultimo).replace(/\D/g, '')) || 0
  return (n: number) => `R${String(base + n + 1).padStart(3, '0')}`
}

export interface ResultadoGeneracion {
  generadas: number
  individuales: number
  grupales: number
  tokens: number
  errores: string[]
}

/**
 * Genera recomendaciones para el alcance indicado.
 *
 * Por estudiante: las dos competencias con mayor brecha bajo Alto.
 * Por curso: una grupal cuando más del 40 % está bajo Alto en la misma competencia.
 */
export async function generarRecomendaciones(
  alcance: Alcance,
  opciones: { usuarioId?: number; incluirGrupales?: boolean } = {}
): Promise<ResultadoGeneracion> {
  const salida: ResultadoGeneracion = {
    generadas: 0, individuales: 0, grupales: 0, tokens: 0, errores: [],
  }
  if (alcanceVacio(alcance)) return salida
  if (!process.env.ANTHROPIC_API_KEY) {
    salida.errores.push('Falta ANTHROPIC_API_KEY en el entorno.')
    return salida
  }

  const db = clienteServidor()
  const cliente = new Anthropic()

  // ---------- Contexto ----------
  const { data: indicesRaw, error: eIdx } = await db.rpc('kpi_indice', { p_semanas: null })
  if (eIdx) throw new Error(`kpi_indice: ${eIdx.message}`)
  const { data: subsRaw, error: eSub } = await db.rpc('kpi_estudiante', { p_semanas: null })
  if (eSub) throw new Error(`kpi_estudiante: ${eSub.message}`)

  const [{ data: usuarios }, { data: cursos }, { data: actividades }] = await Promise.all([
    db.from('usuarios').select('id, codigo, curso_id').eq('rol', 'Estudiante'),
    db.from('cursos').select('id, nombre'),
    db.from('actividades').select('curso_id, nombre, tipo, competencia'),
  ])

  // Perfil de egreso por programa, indexado por curso: el contexto del
  // agente es el estudiante, y el estudiante llega con su curso.
  // Si la tabla no existe todavia (migracion 06 sin aplicar) se sigue sin
  // perfil: es contexto adicional, nunca un requisito para generar.
  const egresoPorCurso = new Map<number, { texto: string; notas: string | null }>()
  {
    const { data: cursosUniv } = await db.from('cursos').select('id, universidad_id')
    const { data: egresos, error: eEgreso } = await db
      .from('perfiles_egreso')
      .select('universidad_id, perfil_egreso, notas, activo')
      .eq('activo', true)

    if (!eEgreso) {
      const porUniv = new Map(
        (egresos ?? []).map((e) => [
          Number(e.universidad_id),
          {
            texto: String(e.perfil_egreso),
            notas: e.notas === null ? null : String(e.notas),
          },
        ])
      )
      for (const c of cursosUniv ?? []) {
        const e = porUniv.get(Number(c.universidad_id))
        if (e) egresoPorCurso.set(Number(c.id), e)
      }
    }
  }

  const nombreCurso = new Map((cursos ?? []).map((c) => [Number(c.id), String(c.nombre)]))
  const datosUsuario = new Map((usuarios ?? []).map((u) => [Number(u.id), u]))
  const subPorUsuario = new Map(
    ((subsRaw ?? []) as Record<string, unknown>[]).map((f) => [Number(f.usuario_id), f])
  )

  const enAlcance = ((indicesRaw ?? []) as Record<string, unknown>[]).filter(
    (f) =>
      (alcance.cursoIds === null || alcance.cursoIds.includes(Number(f.curso_id))) &&
      (alcance.usuarioIds === null || alcance.usuarioIds.includes(Number(f.usuario_id))) &&
      (opciones.usuarioId === undefined || Number(f.usuario_id) === opciones.usuarioId)
  )

  const contextos: ContextoEstudiante[] = enAlcance.map((f) => {
    const uid = Number(f.usuario_id)
    const cid = Number(f.curso_id)
    const sub = subPorUsuario.get(uid) ?? {}
    const num = (v: unknown) => Number(v)
    return {
      usuarioId: uid,
      codigo: String(datosUsuario.get(uid)?.codigo ?? uid),
      cursoId: cid,
      cursoNombre: nombreCurso.get(cid) ?? String(cid),
      indices: {
        ITE: num(f.ite), IAU: num(f.iau), ICOM: num(f.icom),
        IPC: num(f.ipc), IRP: num(f.irp), CTG: num(f.ctg),
      },
      subIndicadores: Object.fromEntries(
        Object.values(SUB_INDICADORES).flat().map((cod) => [
          cod,
          num((sub as Record<string, unknown>)[cod.toLowerCase()]),
        ])
      ),
      actividades: (actividades ?? [])
        .filter((a) => Number(a.curso_id) === cid)
        .map((a) => ({
          nombre: String(a.nombre), tipo: String(a.tipo),
          competencia: String(a.competencia),
        })),
      perfilEgreso: egresoPorCurso.get(cid)?.texto,
      notasEgreso: egresoPorCurso.get(cid)?.notas ?? undefined,
    }
  })

  const codigo = await siguienteCodigo()
  const nuevas: Record<string, unknown>[] = []

  // ---------- Individuales ----------
  for (const ctx of contextos) {
    const brechas = competenciasConBrecha(ctx.indices).slice(0, 2)
    if (brechas.length === 0) continue

    const prompt = [
      bloqueEgreso(ctx),
      `Estudiante ${ctx.codigo} del curso ${ctx.cursoNombre}.`,
      `Competencia Transversal Global: ${ctx.indices.CTG.toFixed(1).replace('.', ',')} %`,
      '',
      'Competencias por debajo del nivel Alto, con mayor brecha primero:',
      ...brechas.map((b) => bloqueCompetencia(ctx, b.competencia, b.codigo)),
      '',
      `Genera ${brechas.length} recomendación${brechas.length > 1 ? 'es' : ''}, una por competencia listada.`,
    ].join('\n')

    try {
      const { recomendaciones, tokens } = await pedirRecomendaciones(cliente, prompt)
      salida.tokens += tokens
      for (const r of recomendaciones) {
        const idx = INDICE_DE_COMPETENCIA[r.competencia]
        const valor = ctx.indices[idx] ?? 0
        nuevas.push({
          codigo: codigo(nuevas.length),
          curso_id: ctx.cursoId,
          usuario_id: ctx.usuarioId,
          tipo: 'Individual',
          competencia: r.competencia,
          nivel_actual: nivelDe(valor).nivel,
          nivel_meta: nivelMetaDe(valor),
          brecha: Math.round(Math.max(UMBRAL_ALTO - valor, 0) * 10) / 10,
          recomendacion: r.recomendacion,
          justificacion: r.justificacion,
          sub_indicador_critico: r.sub_indicador_critico,
          estado: 'Pendiente de revisión docente',
          generada_por: 'agente-ia',
          modelo: MODELO,
          tokens_usados: Math.round(tokens / recomendaciones.length),
        })
        salida.individuales++
      }
    } catch (e) {
      salida.errores.push(`${ctx.codigo}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ---------- Grupales ----------
  if (opciones.incluirGrupales !== false && opciones.usuarioId === undefined) {
    const porCurso = new Map<number, ContextoEstudiante[]>()
    for (const c of contextos) {
      porCurso.set(c.cursoId, [...(porCurso.get(c.cursoId) ?? []), c])
    }

    for (const [cursoId, alumnos] of porCurso) {
      if (alumnos.length === 0) continue
      for (const [competencia, idx] of Object.entries(INDICE_DE_COMPETENCIA)) {
        const bajos = alumnos.filter((a) => (a.indices[idx] ?? 0) < UMBRAL_ALTO)
        const proporcion = bajos.length / alumnos.length
        if (proporcion <= UMBRAL_GRUPAL) continue

        const promedio =
          alumnos.reduce((t, a) => t + (a.indices[idx] ?? 0), 0) / alumnos.length
        const referencia = { ...alumnos[0] }
        referencia.indices = { ...referencia.indices, [idx]: promedio }
        referencia.subIndicadores = Object.fromEntries(
          (SUB_INDICADORES[competencia] ?? []).map((cod) => [
            cod,
            alumnos.reduce((t, a) => t + (a.subIndicadores[cod] ?? 0), 0) / alumnos.length,
          ])
        )

        const prompt = [
          bloqueEgreso(referencia),
          `Curso ${referencia.cursoNombre}, ${alumnos.length} estudiantes.`,
          `${bajos.length} de ${alumnos.length} (${Math.round(proporcion * 100)} %) están por debajo del nivel Alto en ${competencia}.`,
          '',
          'Promedio del curso en esa competencia:',
          bloqueCompetencia(referencia, competencia, idx),
          '',
          'Genera 1 recomendación GRUPAL para todo el curso, no para un estudiante concreto.',
        ].join('\n')

        try {
          const { recomendaciones, tokens } = await pedirRecomendaciones(cliente, prompt)
          salida.tokens += tokens
          const r = recomendaciones[0]
          if (!r) continue
          nuevas.push({
            codigo: codigo(nuevas.length),
            curso_id: cursoId,
            usuario_id: null,
            tipo: 'Grupal',
            competencia,
            nivel_actual: nivelDe(promedio).nivel,
            nivel_meta: nivelMetaDe(promedio),
            brecha: Math.round(Math.max(UMBRAL_ALTO - promedio, 0) * 10) / 10,
            recomendacion: r.recomendacion,
            justificacion: r.justificacion,
            sub_indicador_critico: r.sub_indicador_critico,
            estado: 'Pendiente de revisión docente',
            generada_por: 'agente-ia',
            modelo: MODELO,
            tokens_usados: tokens,
          })
          salida.grupales++
        } catch (e) {
          salida.errores.push(
            `${referencia.cursoNombre} / ${competencia}: ${e instanceof Error ? e.message : String(e)}`
          )
        }
      }
    }
  }

  if (nuevas.length > 0) {
    const { error } = await db.from('recomendaciones_ia').insert(nuevas)
    if (error) throw new Error(`No se pudieron guardar: ${error.message}`)
    salida.generadas = nuevas.length
  }

  return salida
}
