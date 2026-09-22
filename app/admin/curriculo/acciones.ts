'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

export interface EstadoCurriculo {
  error?: string
  ok?: string
}

const CODIGO = /^[A-Za-z0-9_-]{2,30}$/

function texto(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}

function numeroONulo(v: FormDataEntryValue | null): number | null {
  const s = texto(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const AVISO =
  'Falta el modelo curricular. Aplica supabase/migraciones/09_curriculo.sql ' +
  'desde el SQL Editor.'

/** Traduce el error de Postgres a algo que el administrador pueda arreglar. */
function mensaje(error: { code?: string; message: string }, que: string): string {
  if (faltaMigracion(error.code)) return AVISO
  if (error.code === '23505') return `Ya existe ${que} con ese código o nombre.`
  if (error.code === '23503') return 'Falta un dato relacionado: revisa las selecciones.'
  return `No se pudo guardar: ${error.message}`
}

// ============================================================
// MACRO
// ============================================================

export async function crearInstitucion(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  await exigirRol(['admin'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const nombre = texto(formulario.get('nombre'))
  const siglas = texto(formulario.get('siglas'))
  const pais = texto(formulario.get('pais'))
  const universidadId = numeroONulo(formulario.get('universidad_id'))

  if (!CODIGO.test(codigo)) return { error: 'Código no válido.' }
  if (nombre.length < 3) return { error: 'El nombre de la institución es obligatorio.' }

  const db = clienteServidor()
  const { error } = await db.from('instituciones').insert({
    codigo, nombre,
    siglas: siglas || null,
    pais: pais || null,
    universidad_id: universidadId,
  })

  if (error) return { error: mensaje(error, 'una institución') }

  revalidatePath('/admin/curriculo')
  return { ok: `Institución ${nombre} creada.` }
}

export async function crearFacultad(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  await exigirRol(['admin'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const nombre = texto(formulario.get('nombre'))
  const institucionId = numeroONulo(formulario.get('institucion_id'))

  if (!CODIGO.test(codigo)) return { error: 'Código no válido.' }
  if (nombre.length < 3) return { error: 'El nombre de la facultad es obligatorio.' }
  if (institucionId === null) return { error: 'Selecciona una institución.' }

  const db = clienteServidor()
  const { error } = await db.from('facultades').insert({
    codigo, nombre, institucion_id: institucionId,
  })

  if (error) return { error: mensaje(error, 'una facultad') }

  revalidatePath('/admin/curriculo')
  return { ok: `Facultad ${nombre} creada.` }
}

/**
 * Datos macro del programa: perfil de egreso, propósitos, plan de estudios.
 *
 * Es un upsert por programa: cada programa tiene una sola ficha macro y
 * editarla la reemplaza, no la duplica.
 */
export async function guardarMacro(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  const { perfil } = await exigirRol(['admin'])

  const programaId = numeroONulo(formulario.get('programa_id'))
  if (programaId === null) return { error: 'Selecciona un programa.' }

  const db = clienteServidor()
  const { error } = await db.from('programas_macro').upsert(
    {
      programa_id: programaId,
      facultad_id: numeroONulo(formulario.get('facultad_id')),
      perfil_egreso: texto(formulario.get('perfil_egreso')) || null,
      propositos: texto(formulario.get('propositos')) || null,
      plan_estudios: texto(formulario.get('plan_estudios')) || null,
      modalidad: texto(formulario.get('modalidad')) || null,
      nivel: texto(formulario.get('nivel')) || null,
      duracion_semestres: numeroONulo(formulario.get('duracion_semestres')),
      abet_adoptado: formulario.get('abet_adoptado') !== null,
      actualizado_por: perfil.id,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: 'programa_id' }
  )

  if (error) return { error: mensaje(error, 'una ficha macro') }

  revalidatePath('/admin/curriculo')
  return { ok: 'Datos macro del programa guardados.' }
}

// ============================================================
// MESO
// ============================================================

export async function crearArea(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  await exigirRol(['admin'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const nombre = texto(formulario.get('nombre'))
  const programaId = numeroONulo(formulario.get('programa_id'))
  const tipo = texto(formulario.get('tipo'))

  if (!CODIGO.test(codigo)) return { error: 'Código no válido.' }
  if (nombre.length < 3) return { error: 'El nombre del área es obligatorio.' }
  if (programaId === null) return { error: 'Selecciona un programa.' }

  const db = clienteServidor()
  const { error } = await db.from('areas').insert({
    codigo, nombre, programa_id: programaId,
    tipo: tipo || null,
    descripcion: texto(formulario.get('descripcion')) || null,
  })

  if (error) return { error: mensaje(error, 'un área') }

  revalidatePath('/admin/curriculo')
  return { ok: `Área ${nombre} creada.` }
}

export async function crearLinea(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  await exigirRol(['admin'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const nombre = texto(formulario.get('nombre'))
  const programaId = numeroONulo(formulario.get('programa_id'))

  if (!CODIGO.test(codigo)) return { error: 'Código no válido.' }
  if (nombre.length < 3) return { error: 'El nombre de la línea es obligatorio.' }
  if (programaId === null) return { error: 'Selecciona un programa.' }

  const db = clienteServidor()
  const { error } = await db.from('lineas_curriculares').insert({
    codigo, nombre, programa_id: programaId,
    descripcion: texto(formulario.get('descripcion')) || null,
  })

  if (error) return { error: mensaje(error, 'una línea curricular') }

  revalidatePath('/admin/curriculo')
  return { ok: `Línea ${nombre} creada.` }
}

/** Ubica una asignatura en el plan: área, línea y semestre. */
export async function ubicarCurso(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  await exigirRol(['admin'])

  const cursoId = numeroONulo(formulario.get('curso_id'))
  if (cursoId === null) return { error: 'Selecciona una asignatura.' }

  const areaId = numeroONulo(formulario.get('area_id'))
  const lineaId = numeroONulo(formulario.get('linea_id'))

  // Sin área ni línea la fila no ubica nada: sería ruido en la tabla.
  if (areaId === null && lineaId === null) {
    return { error: 'Indica al menos un área o una línea curricular.' }
  }

  const db = clienteServidor()
  const { error } = await db.from('cursos_meso').insert({
    curso_id: cursoId,
    area_id: areaId,
    linea_id: lineaId,
    semestre: numeroONulo(formulario.get('semestre')),
    creditos: numeroONulo(formulario.get('creditos')),
  })

  if (error) return { error: mensaje(error, 'esa ubicación') }

  revalidatePath('/admin/curriculo')
  return { ok: 'Asignatura ubicada en el plan.' }
}

// ============================================================
// MICRO
// ============================================================

export async function guardarMicro(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  const { perfil } = await exigirRol(['admin', 'docente', 'coordinador'])

  const cursoId = numeroONulo(formulario.get('curso_id'))
  if (cursoId === null) return { error: 'Selecciona una asignatura.' }

  const db = clienteServidor()
  const { error } = await db.from('cursos_micro').upsert(
    {
      curso_id: cursoId,
      descripcion: texto(formulario.get('descripcion')) || null,
      justificacion: texto(formulario.get('justificacion')) || null,
      metodologia: texto(formulario.get('metodologia')) || null,
      evaluacion: texto(formulario.get('evaluacion')) || null,
      actualizado_por: perfil.id,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: 'curso_id' }
  )

  if (error) return { error: mensaje(error, 'esa ficha') }

  revalidatePath('/admin/curriculo')
  return { ok: 'Ficha de la asignatura guardada.' }
}

export async function crearUnidad(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  await exigirRol(['admin', 'docente', 'coordinador'])

  const cursoId = numeroONulo(formulario.get('curso_id'))
  const nombre = texto(formulario.get('nombre'))
  let codigo = texto(formulario.get('codigo')).toUpperCase()

  if (cursoId === null) return { error: 'Selecciona una asignatura.' }
  if (nombre.length < 3) return { error: 'El nombre de la unidad es obligatorio.' }

  const db = clienteServidor()

  // Sin código explícito se numera por orden dentro del curso.
  if (!codigo) {
    const { count } = await db
      .from('unidades').select('id', { count: 'exact', head: true }).eq('curso_id', cursoId)
    codigo = `U${String((count ?? 0) + 1).padStart(2, '0')}`
  }

  if (!CODIGO.test(codigo)) return { error: 'Código no válido.' }

  const semanaInicio = numeroONulo(formulario.get('semana_inicio'))
  const semanaFin = numeroONulo(formulario.get('semana_fin'))

  if (semanaInicio !== null && semanaFin !== null && semanaFin < semanaInicio) {
    return { error: 'La semana final no puede ser anterior a la inicial.' }
  }

  const { error } = await db.from('unidades').insert({
    codigo, nombre, curso_id: cursoId,
    descripcion: texto(formulario.get('descripcion')) || null,
    semana_inicio: semanaInicio,
    semana_fin: semanaFin,
  })

  if (error) return { error: mensaje(error, 'una unidad') }

  revalidatePath('/admin/curriculo')
  return { ok: `Unidad ${nombre} creada como ${codigo}.` }
}

// ============================================================
// RESULTADOS DE APRENDIZAJE
// ============================================================

/**
 * Crea un resultado de aprendizaje en el nivel que corresponda.
 *
 * Es el eslabón que faltaba en la trazabilidad: sin RA, la cadena
 * «RA → competencia → indicador → evidencia» está construida pero vacía
 * por el centro.
 */
export async function crearResultado(
  _previo: EstadoCurriculo,
  formulario: FormData
): Promise<EstadoCurriculo> {
  await exigirRol(['admin', 'coordinador', 'docente'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const enunciado = texto(formulario.get('enunciado'))
  const ambito = texto(formulario.get('ambito'))
  const competenciaId = numeroONulo(formulario.get('competencia_id'))
  const programaId = numeroONulo(formulario.get('programa_id'))
  const areaId = numeroONulo(formulario.get('area_id'))
  const cursoId = numeroONulo(formulario.get('curso_id'))

  if (!CODIGO.test(codigo)) return { error: 'Código no válido.' }
  if (enunciado.length < 15) {
    return {
      error:
        'Enuncia el resultado de aprendizaje con al menos 15 caracteres: ' +
        'debe decir qué será capaz de hacer el estudiante.',
    }
  }
  if (!['Programa', 'Area', 'Curso'].includes(ambito)) {
    return { error: 'Ámbito no válido.' }
  }

  // Cada ámbito exige su propia referencia. Sin ella el RA quedaría
  // colgando y no aparecería en ninguna consulta.
  if (ambito === 'Programa' && programaId === null) {
    return { error: 'Un resultado de programa necesita un programa.' }
  }
  if (ambito === 'Area' && areaId === null) {
    return { error: 'Un resultado de área necesita un área.' }
  }
  if (ambito === 'Curso' && cursoId === null) {
    return { error: 'Un resultado de curso necesita una asignatura.' }
  }

  const db = clienteServidor()
  const { error } = await db.from('resultados').insert({
    codigo, enunciado, ambito,
    programa_id: ambito === 'Programa' ? programaId : null,
    area_id: ambito === 'Area' ? areaId : null,
    curso_id: ambito === 'Curso' ? cursoId : null,
    competencia_id: competenciaId,
  })

  if (error) return { error: mensaje(error, 'un resultado con ese código') }

  revalidatePath('/admin/curriculo')
  return { ok: `Resultado ${codigo} creado.` }
}

/**
 * Enlaza un resultado de aprendizaje con el indicador que lo evidencia.
 *
 * Es lo que cierra la trazabilidad: sin este enlace se puede saber que un
 * indicador vale 35 %, pero no qué resultado de aprendizaje está en
 * riesgo por ello.
 */
export async function enlazarIndicador(formulario: FormData) {
  await exigirRol(['admin', 'coordinador', 'docente'])

  const resultadoId = numeroONulo(formulario.get('resultado_id'))
  const indicadorId = numeroONulo(formulario.get('indicador_id'))
  if (resultadoId === null || indicadorId === null) return

  const db = clienteServidor()
  await db.from('resultado_indicadores').upsert(
    { resultado_id: resultadoId, indicador_id: indicadorId, peso: 1 },
    { onConflict: 'resultado_id,indicador_id' }
  )

  revalidatePath('/admin/curriculo')
}

export async function desenlazarIndicador(formulario: FormData) {
  await exigirRol(['admin', 'coordinador', 'docente'])

  const resultadoId = numeroONulo(formulario.get('resultado_id'))
  const indicadorId = numeroONulo(formulario.get('indicador_id'))
  if (resultadoId === null || indicadorId === null) return

  const db = clienteServidor()
  await db
    .from('resultado_indicadores')
    .delete()
    .eq('resultado_id', resultadoId)
    .eq('indicador_id', indicadorId)

  revalidatePath('/admin/curriculo')
}

/** Declara qué competencias desarrolla un área o una asignatura. */
export async function vincularCompetencia(formulario: FormData) {
  await exigirRol(['admin', 'coordinador'])

  const competenciaId = numeroONulo(formulario.get('competencia_id'))
  const areaId = numeroONulo(formulario.get('area_id'))
  const cursoId = numeroONulo(formulario.get('curso_id'))
  const nivel = texto(formulario.get('nivel'))
  if (competenciaId === null) return

  const db = clienteServidor()

  if (areaId !== null) {
    await db.from('area_competencias').upsert(
      { area_id: areaId, competencia_id: competenciaId, nivel: nivel || null },
      { onConflict: 'area_id,competencia_id' }
    )
  } else if (cursoId !== null) {
    await db.from('curso_competencias').upsert(
      { curso_id: cursoId, competencia_id: competenciaId, nivel: nivel || null },
      { onConflict: 'curso_id,competencia_id' }
    )
  }

  revalidatePath('/admin/curriculo')
}
