'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import type { Alcance } from '@/lib/auth/alcance'

export interface EstadoEstudiante {
  error?: string
  ok?: string
}

function texto(v: FormDataEntryValue | null): string {
  return String(v ?? '').trim()
}

/** ¿Este curso está dentro de lo que el perfil puede tocar? */
async function cursoEnAlcance(cursoId: number | null, alcance: Alcance): Promise<boolean> {
  if (alcance.rol === 'admin') return true
  if (cursoId === null) return false
  if (alcance.cursoIds !== null) return alcance.cursoIds.includes(cursoId)
  if (alcance.programaIds === null && alcance.universidadIds === null) return true

  const db = clienteServidor()
  const { data: curso } = await db
    .from('cursos').select('programa_id, universidad_id').eq('id', cursoId).maybeSingle()
  if (!curso) return false
  if (alcance.programaIds !== null) {
    return curso.programa_id != null && alcance.programaIds.includes(Number(curso.programa_id))
  }
  return alcance.universidadIds!.includes(Number(curso.universidad_id))
}

/**
 * Edita un estudiante: código, nombre, semestre y grupo.
 *
 * El grupo determina curso y universidad, así que esos dos se derivan de
 * él en vez de pedirlos aparte: no pueden quedar incoherentes. Los datos
 * de actividad cuelgan del estudiante, no del grupo, así que moverlo de
 * grupo no pierde historial.
 *
 * Un coordinador sólo edita estudiantes de su programa, y sólo puede
 * moverlos a grupos de su programa.
 */
export async function editarEstudiante(
  _previo: EstadoEstudiante,
  formulario: FormData
): Promise<EstadoEstudiante> {
  const { alcance } = await exigirRol(['admin', 'coordinador'], '/admin/estudiantes')

  const id = Number(formulario.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { error: 'Estudiante no válido.' }

  const codigo = texto(formulario.get('codigo'))
  const nombre = texto(formulario.get('nombre'))
  const semestreTxt = texto(formulario.get('semestre'))
  const grupoTxt = texto(formulario.get('grupo_id'))

  if (!codigo) return { error: 'Escribe un código.' }
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  let semestre: number | null = null
  if (semestreTxt) {
    semestre = Number(semestreTxt)
    if (!Number.isInteger(semestre) || semestre < 1 || semestre > 20) {
      return { error: 'El semestre debe ser un número entre 1 y 20.' }
    }
  }

  const db = clienteServidor()
  const { data: actual } = await db
    .from('usuarios').select('id, curso_id').eq('id', id).eq('rol', 'Estudiante').maybeSingle()
  if (!actual) return { error: 'El estudiante ya no existe.' }

  if (!(await cursoEnAlcance(actual.curso_id == null ? null : Number(actual.curso_id), alcance))) {
    return { error: 'Ese estudiante está fuera de tu alcance.' }
  }

  const cambios: Record<string, unknown> = { codigo, nombre, semestre }

  if (grupoTxt) {
    const grupoId = Number(grupoTxt)
    const { data: grupo } = await db
      .from('grupos').select('id, curso_id, cursos(universidad_id)').eq('id', grupoId).maybeSingle()
    if (!grupo) return { error: 'El grupo elegido no existe.' }

    const cursoId = Number(grupo.curso_id)
    if (!(await cursoEnAlcance(cursoId, alcance))) {
      return { error: 'Ese grupo está fuera de tu alcance.' }
    }
    const curso = (Array.isArray(grupo.cursos) ? grupo.cursos[0] : grupo.cursos) as
      { universidad_id: number } | null

    cambios.grupo_id = grupoId
    cambios.curso_id = cursoId
    if (curso) cambios.universidad_id = Number(curso.universidad_id)
  }

  const { error } = await db.from('usuarios').update(cambios).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: `Ya existe otro estudiante con el código ${codigo}.` }
    return { error: `No se pudo guardar: ${error.message}` }
  }

  revalidatePath('/admin/estudiantes')
  revalidatePath('/admin/jerarquia')
  return { ok: `${nombre} actualizado.` }
}
