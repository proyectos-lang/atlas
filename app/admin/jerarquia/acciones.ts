'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

export interface EstadoJerarquia {
  error?: string
  ok?: string
}

/** Códigos de negocio: letras, dígitos y guiones. Se usan en la URL. */
const CODIGO = /^[A-Za-z0-9_-]{2,20}$/

function texto(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}

function entero(v: FormDataEntryValue | null): number | null {
  const s = texto(v)
  if (!s) return null
  const n = Number(s)
  return Number.isInteger(n) && n > 0 ? n : null
}

const AVISO_MIGRACION =
  'Falta la jerarquía en la base de datos. Aplica ' +
  'supabase/migraciones/08_jerarquia.sql desde el SQL Editor.'

// ---------- Programas ----------

/**
 * Crea un programa dentro de una universidad.
 *
 * Un programa agrupa cursos y es el nivel al que pertenece el perfil de
 * egreso. No mueve ningún dato de hechos: los indicadores no cambian al
 * crear uno.
 */
export async function crearPrograma(
  _previo: EstadoJerarquia,
  formulario: FormData
): Promise<EstadoJerarquia> {
  await exigirRol(['admin'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const nombre = texto(formulario.get('nombre'))
  const universidadId = entero(formulario.get('universidad_id'))
  const modalidad = texto(formulario.get('modalidad'))

  if (!CODIGO.test(codigo)) {
    return { error: 'El código debe tener entre 2 y 20 caracteres: letras, dígitos o guiones.' }
  }
  if (nombre.length < 3) return { error: 'El nombre del programa es obligatorio.' }
  if (universidadId === null) return { error: 'Selecciona una universidad.' }

  const db = clienteServidor()
  const { error } = await db.from('programas').insert({
    codigo,
    nombre,
    universidad_id: universidadId,
    modalidad: modalidad || null,
  })

  if (error) {
    if (faltaMigracion(error.code)) return { error: AVISO_MIGRACION }
    if (error.code === '23505') {
      return { error: `Ya existe un programa con el código ${codigo} o ese nombre en la universidad.` }
    }
    return { error: `No se pudo crear el programa: ${error.message}` }
  }

  revalidatePath('/admin/jerarquia')
  return { ok: `Programa ${nombre} creado.` }
}

// ---------- Grupos ----------

/**
 * Crea un grupo (sección) dentro de un curso, con su docente opcional.
 *
 * El grupo es el nivel donde un docente concreto se hace responsable de un
 * subconjunto de estudiantes del curso.
 */
export async function crearGrupo(
  _previo: EstadoJerarquia,
  formulario: FormData
): Promise<EstadoJerarquia> {
  await exigirRol(['admin'])

  const cursoId = entero(formulario.get('curso_id'))
  const nombre = texto(formulario.get('nombre'))
  const docenteId = entero(formulario.get('docente_id'))
  const periodo = texto(formulario.get('periodo'))
  let codigo = texto(formulario.get('codigo')).toUpperCase()

  if (cursoId === null) return { error: 'Selecciona un curso.' }
  if (nombre.length < 2) return { error: 'El nombre del grupo es obligatorio.' }

  const db = clienteServidor()

  // Sin código explícito se deriva del curso: C01-G2, C01-G3…
  if (!codigo) {
    const { data: curso } = await db
      .from('cursos').select('codigo').eq('id', cursoId).maybeSingle()
    if (!curso) return { error: 'El curso indicado no existe.' }

    const { count } = await db
      .from('grupos')
      .select('id', { count: 'exact', head: true })
      .eq('curso_id', cursoId)

    codigo = `${String(curso.codigo)}-G${(count ?? 0) + 1}`
  }

  if (!CODIGO.test(codigo)) {
    return { error: 'El código debe tener entre 2 y 20 caracteres: letras, dígitos o guiones.' }
  }

  const { error } = await db.from('grupos').insert({
    codigo,
    nombre,
    curso_id: cursoId,
    docente_id: docenteId,
    periodo: periodo || null,
  })

  if (error) {
    if (faltaMigracion(error.code)) return { error: AVISO_MIGRACION }
    if (error.code === '23505') {
      return { error: `Ya existe un grupo con el código ${codigo} o ese nombre en el curso.` }
    }
    return { error: `No se pudo crear el grupo: ${error.message}` }
  }

  revalidatePath('/admin/jerarquia')
  return { ok: `Grupo ${nombre} creado como ${codigo}.` }
}

/**
 * Asigna (o retira) el docente de un grupo.
 *
 * El docente es un perfil, no una fila de `usuarios`: en este modelo los
 * docentes existen como cuentas de acceso, no como registros de datos.
 *
 * Asignar el docente NO le da acceso por sí solo: para que vea únicamente
 * ese grupo, su perfil debe tener `grupo_id` en la pantalla de perfiles.
 * Son dos cosas distintas y la interfaz lo advierte.
 */
export async function asignarDocente(formulario: FormData) {
  await exigirRol(['admin'])

  const grupoId = entero(formulario.get('grupo_id'))
  if (grupoId === null) return

  const docenteId = entero(formulario.get('docente_id'))

  const db = clienteServidor()
  await db.from('grupos').update({ docente_id: docenteId }).eq('id', grupoId)

  revalidatePath('/admin/jerarquia')
}

/** Activa o desactiva un grupo sin borrarlo. */
export async function alternarGrupo(formulario: FormData) {
  await exigirRol(['admin'])

  const id = entero(formulario.get('id'))
  if (id === null) return
  const activo = String(formulario.get('activo')) === 'true'

  const db = clienteServidor()
  await db.from('grupos').update({ activo: !activo }).eq('id', id)

  revalidatePath('/admin/jerarquia')
}

/**
 * Mueve un curso a otro programa.
 *
 * Es lo que permite reorganizar la jerarquía sin tocar los datos de
 * hechos: cambiar el programa de un curso no altera ningún indicador,
 * sólo bajo qué rama aparece.
 */
export async function moverCurso(formulario: FormData) {
  await exigirRol(['admin'])

  const cursoId = entero(formulario.get('curso_id'))
  const programaId = entero(formulario.get('programa_id'))
  if (cursoId === null || programaId === null) return

  const db = clienteServidor()

  // La universidad del curso debe seguir la del programa; si no, el
  // alcance por universidad dejaría de casar con el alcance por programa.
  const { data: programa } = await db
    .from('programas').select('universidad_id').eq('id', programaId).maybeSingle()
  if (!programa) return

  await db
    .from('cursos')
    .update({ programa_id: programaId, universidad_id: programa.universidad_id })
    .eq('id', cursoId)

  revalidatePath('/admin/jerarquia')
}
