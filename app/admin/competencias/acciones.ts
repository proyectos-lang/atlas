'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'

export interface EstadoCompetencia {
  error?: string
  ok?: string
}

const CODIGO = /^[A-Za-z0-9_-]{2,30}$/

const AGREGACIONES = ['Promedio', 'Suma', 'Proporcion', 'Conteo', 'Rubrica']
const ESCALAS = ['Porcentaje', 'Puntos']

function texto(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}

function numeroONulo(v: FormDataEntryValue | null): number | null {
  const s = texto(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function faltaTabla(codigo?: string): boolean {
  return codigo === 'PGRST205' || codigo === '42P01' || codigo === '42703'
}

const AVISO =
  'Falta el modelo curricular en la base de datos. Aplica ' +
  'supabase/migraciones/09_curriculo.sql y 10_seed_competencias.sql ' +
  'desde el SQL Editor.'

// ---------- Competencias ----------

/**
 * Crea una competencia.
 *
 * `student_outcome` vacío en una competencia transversal la marca como
 * COMPLEMENTARIA: se trabaja en el programa pero no corresponde a ningún
 * Student Outcome de ABET. Es una distinción del modelo, no un descuido.
 */
export async function crearCompetencia(
  _previo: EstadoCompetencia,
  formulario: FormData
): Promise<EstadoCompetencia> {
  await exigirRol(['admin'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const nombre = texto(formulario.get('nombre'))
  const descripcion = texto(formulario.get('descripcion'))
  const studentOutcome = texto(formulario.get('student_outcome'))
  const transversal = formulario.get('transversal') !== null

  if (!CODIGO.test(codigo)) {
    return { error: 'El código debe tener entre 2 y 30 caracteres: letras, dígitos o guiones.' }
  }
  if (nombre.length < 3) return { error: 'El nombre de la competencia es obligatorio.' }

  const db = clienteServidor()
  const { error } = await db.from('competencias').insert({
    codigo,
    nombre,
    descripcion: descripcion || null,
    transversal,
    student_outcome: studentOutcome || null,
  })

  if (error) {
    if (faltaTabla(error.code)) return { error: AVISO }
    if (error.code === '23505') return { error: `Ya existe una competencia con código ${codigo}.` }
    return { error: `No se pudo crear: ${error.message}` }
  }

  revalidatePath('/admin/competencias')
  return { ok: `Competencia ${nombre} creada.` }
}

// ---------- Dimensiones ----------

/**
 * Crea una dimensión dentro de una competencia.
 *
 * La dimensión es lo observable: una competencia no se mide de golpe, se
 * mide por las conductas en que se manifiesta.
 */
export async function crearDimension(
  _previo: EstadoCompetencia,
  formulario: FormData
): Promise<EstadoCompetencia> {
  await exigirRol(['admin'])

  const competenciaId = numeroONulo(formulario.get('competencia_id'))
  const nombre = texto(formulario.get('nombre'))
  const descripcion = texto(formulario.get('descripcion'))
  let codigo = texto(formulario.get('codigo')).toUpperCase()

  if (competenciaId === null) return { error: 'Selecciona una competencia.' }
  if (nombre.length < 3) return { error: 'El nombre de la dimensión es obligatorio.' }

  const db = clienteServidor()

  // Sin código explícito se deriva del de la competencia: CE-D3, CE-D4…
  if (!codigo) {
    const { data: comp } = await db
      .from('competencias').select('codigo').eq('id', competenciaId).maybeSingle()
    if (!comp) return { error: 'La competencia indicada no existe.' }

    const { count } = await db
      .from('dimensiones')
      .select('id', { count: 'exact', head: true })
      .eq('competencia_id', competenciaId)

    codigo = `${String(comp.codigo)}-D${(count ?? 0) + 1}`
  }

  if (!CODIGO.test(codigo)) return { error: 'Código de dimensión no válido.' }

  const { error } = await db.from('dimensiones').insert({
    codigo,
    nombre,
    descripcion: descripcion || null,
    competencia_id: competenciaId,
  })

  if (error) {
    if (faltaTabla(error.code)) return { error: AVISO }
    if (error.code === '23505') {
      return { error: `Ya existe una dimensión con ese código o nombre en la competencia.` }
    }
    return { error: `No se pudo crear: ${error.message}` }
  }

  revalidatePath('/admin/competencias')
  return { ok: `Dimensión ${nombre} creada como ${codigo}.` }
}

// ---------- Indicadores ----------

/**
 * Crea un indicador configurable dentro de una dimensión.
 *
 * A diferencia de los 22 sub-indicadores del motor anterior --fórmulas
 * literales dentro de kpi_estudiante()-- estos se definen aquí. La
 * `agregacion` dice cómo se calcula a partir de las evidencias:
 *
 *   Promedio    media de los valores
 *   Suma        suma contrastada con el valor esperado
 *   Proporcion  cuántas superan el umbral, sobre el total
 *   Conteo      número de evidencias
 *   Rubrica     suma de obtenido sobre suma de máximo
 */
export async function crearIndicador(
  _previo: EstadoCompetencia,
  formulario: FormData
): Promise<EstadoCompetencia> {
  await exigirRol(['admin'])

  const dimensionId = numeroONulo(formulario.get('dimension_id'))
  const nombre = texto(formulario.get('nombre'))
  const agregacion = texto(formulario.get('agregacion'))
  const escala = texto(formulario.get('escala')) || 'Porcentaje'
  const valorEsperado = numeroONulo(formulario.get('valor_esperado'))
  const umbral = numeroONulo(formulario.get('umbral'))
  const truncar = formulario.get('trunca_100') !== null
  const prorratea = formulario.get('prorratea') !== null
  let codigo = texto(formulario.get('codigo')).toUpperCase()

  if (dimensionId === null) return { error: 'Selecciona una dimensión.' }
  if (nombre.length < 3) return { error: 'El nombre del indicador es obligatorio.' }
  if (!AGREGACIONES.includes(agregacion)) return { error: 'Tipo de cálculo no válido.' }
  if (!ESCALAS.includes(escala)) return { error: 'Escala no válida.' }

  // Cada agregación necesita lo suyo; sin esto el indicador se guardaría
  // y luego no podría calcularse, sin que nadie supiera por qué.
  if (agregacion === 'Suma' && valorEsperado === null) {
    return { error: 'Una suma necesita un valor esperado: es el denominador.' }
  }
  if (agregacion === 'Proporcion' && umbral === null) {
    return { error: 'Una proporción necesita un umbral: el corte que separa logro de no logro.' }
  }
  // Sin referencia, un conteo devuelve un número sin escala que se
  // mezclaría con los porcentajes y corrompería el valor de la competencia.
  if (agregacion === 'Conteo' && valorEsperado === null) {
    return {
      error:
        'Un conteo necesita un valor esperado: cuántas evidencias equivalen al 100 %. ' +
        'Sin él, el indicador no puede compararse con los demás.',
    }
  }

  const db = clienteServidor()

  if (!codigo) {
    const { data: dim } = await db
      .from('dimensiones').select('codigo').eq('id', dimensionId).maybeSingle()
    if (!dim) return { error: 'La dimensión indicada no existe.' }

    const { count } = await db
      .from('indicadores')
      .select('id', { count: 'exact', head: true })
      .eq('dimension_id', dimensionId)

    codigo = `${String(dim.codigo)}-I${(count ?? 0) + 1}`
  }

  if (!CODIGO.test(codigo)) return { error: 'Código de indicador no válido.' }

  const { error } = await db.from('indicadores').insert({
    codigo,
    nombre,
    dimension_id: dimensionId,
    agregacion,
    escala,
    valor_esperado: valorEsperado,
    umbral,
    trunca_100: truncar,
    prorratea,
  })

  if (error) {
    if (faltaTabla(error.code)) return { error: AVISO }
    if (error.code === '23505') return { error: `Ya existe un indicador con código ${codigo}.` }
    return { error: `No se pudo crear: ${error.message}` }
  }

  revalidatePath('/admin/competencias')
  return { ok: `Indicador ${nombre} creado como ${codigo}.` }
}

/** Activa o desactiva sin borrar. Conserva lo ya medido con él. */
export async function alternarIndicador(formulario: FormData) {
  await exigirRol(['admin'])

  const id = numeroONulo(formulario.get('id'))
  if (id === null) return
  const activo = String(formulario.get('activo')) === 'true'

  const db = clienteServidor()
  await db.from('indicadores').update({ activo: !activo }).eq('id', id)

  revalidatePath('/admin/competencias')
}

export async function alternarDimension(formulario: FormData) {
  await exigirRol(['admin'])

  const id = numeroONulo(formulario.get('id'))
  if (id === null) return
  const activo = String(formulario.get('activo')) === 'true'

  const db = clienteServidor()
  await db.from('dimensiones').update({ activo: !activo }).eq('id', id)

  revalidatePath('/admin/competencias')
}
