'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

/**
 * Acciones del asistente de creación que no existían en ninguna otra
 * pantalla: universidad y curso. Programa, grupo y resultado de
 * aprendizaje reutilizan las de jerarquía y currículo.
 *
 * Todas devuelven `id` y `nombre` de lo creado: es lo que permite que el
 * asistente encadene «ahora crea un programa en esta universidad» sin
 * obligar a buscarla de nuevo.
 */

export interface EstadoCreacion {
  error?: string
  ok?: string
  id?: number
  nombre?: string
}

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

/** Siguiente código de una serie: U01, U02… o C01, C02… */
async function siguienteCodigo(tabla: string, prefijo: string): Promise<string> {
  const db = clienteServidor()
  const { count } = await db.from(tabla).select('id', { count: 'exact', head: true })
  return `${prefijo}${String((count ?? 0) + 1).padStart(2, '0')}`
}

function refrescar() {
  for (const r of ['/admin/crear', '/admin/jerarquia', '/admin/perfiles', '/inicio']) {
    revalidatePath(r)
  }
}

/**
 * Crea una universidad.
 *
 * No existía pantalla para esto: el usuario lo reportó como «errores al
 * crear universidades» cuando en realidad no había dónde.
 *
 * La columna `programa` de esta tabla es obsoleta desde la migración 08 y
 * se deja en null. Hasta la migración 18 era NOT NULL, así que si la base
 * la rechaza se dice qué aplicar en vez de devolver el error técnico.
 */
export async function crearUniversidad(
  _previo: EstadoCreacion,
  formulario: FormData
): Promise<EstadoCreacion> {
  await exigirRol(['admin'], '/admin/crear')

  const nombre = texto(formulario.get('nombre'))
  const modalidad = texto(formulario.get('modalidad'))
  let codigo = texto(formulario.get('codigo')).toUpperCase()

  if (nombre.length < 3) return { error: 'El nombre de la universidad es obligatorio.' }

  if (!codigo) codigo = await siguienteCodigo('universidades', 'U')
  if (!CODIGO.test(codigo)) {
    return { error: 'El código debe tener entre 2 y 20 caracteres: letras, dígitos o guiones.' }
  }

  const db = clienteServidor()
  const { data, error } = await db
    .from('universidades')
    .insert({
      codigo,
      universidad: nombre,
      modalidad: modalidad || null,
      programa: null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23502') {
      return {
        error:
          'La base de datos todavía exige un programa de texto en la universidad. ' +
          'Aplica supabase/migraciones/18_edicion_y_egreso_por_programa.sql.',
      }
    }
    if (error.code === '23505') return { error: `Ya existe una universidad con el código ${codigo}.` }
    if (faltaMigracion(error.code)) return { error: 'Falta aplicar una migración.' }
    return { error: `No se pudo crear la universidad: ${error.message}` }
  }

  refrescar()
  return { ok: `Universidad ${nombre} creada como ${codigo}.`, id: Number(data.id), nombre }
}

/**
 * Crea un curso (asignatura) dentro de un programa.
 *
 * `cursos.universidad_id` es NOT NULL y se deriva del programa: pedirla
 * aparte permitiría una incoherencia entre ambas que luego rompería el
 * alcance por universidad.
 */
export async function crearCurso(
  _previo: EstadoCreacion,
  formulario: FormData
): Promise<EstadoCreacion> {
  const { alcance } = await exigirRol(['admin', 'coordinador'], '/admin/crear')

  const programaId = entero(formulario.get('programa_id'))
  const nombre = texto(formulario.get('nombre'))
  const semanas = entero(formulario.get('semanas')) ?? 6
  const periodo = texto(formulario.get('periodo'))
  let codigo = texto(formulario.get('codigo')).toUpperCase()

  if (programaId === null) return { error: 'Selecciona el programa al que pertenece.' }
  if (nombre.length < 3) return { error: 'El nombre del curso es obligatorio.' }
  if (semanas < 1 || semanas > 52) return { error: 'Las semanas deben estar entre 1 y 52.' }

  // Un coordinador sólo crea cursos en su programa.
  if (alcance.programaIds !== null && !alcance.programaIds.includes(programaId)) {
    return { error: 'Ese programa está fuera de tu alcance.' }
  }

  const db = clienteServidor()
  const { data: programa } = await db
    .from('programas').select('universidad_id').eq('id', programaId).maybeSingle()
  if (!programa) return { error: 'El programa indicado no existe.' }

  if (!codigo) codigo = await siguienteCodigo('cursos', 'C')
  if (!CODIGO.test(codigo)) {
    return { error: 'El código debe tener entre 2 y 20 caracteres: letras, dígitos o guiones.' }
  }

  const { data, error } = await db
    .from('cursos')
    .insert({
      codigo,
      nombre,
      programa_id: programaId,
      universidad_id: programa.universidad_id,
      semanas,
      periodo: periodo || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: `Ya existe un curso con el código ${codigo}.` }
    if (faltaMigracion(error.code)) return { error: 'Falta aplicar una migración.' }
    return { error: `No se pudo crear el curso: ${error.message}` }
  }

  // Un curso nace con su grupo por defecto, como hizo la migración 08 con
  // los existentes: sin grupo, sus estudiantes no aparecerían al filtrar.
  await db.from('grupos').insert({
    codigo: `${codigo}-G1`,
    nombre: 'Grupo 1',
    curso_id: Number(data.id),
    periodo: periodo || null,
  })

  refrescar()
  return { ok: `Curso ${nombre} creado como ${codigo}, con su Grupo 1.`, id: Number(data.id), nombre }
}
