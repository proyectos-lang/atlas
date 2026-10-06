'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirSesion } from '@/lib/auth/sesion'
import { type Alcance } from '@/lib/auth/alcance'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'
import {
  entidadDe, validarCampo, describirDependientes, type Entidad,
} from '@/lib/admin/entidades'

export interface EstadoEntidad {
  error?: string
  ok?: string
}

type Fila = Record<string, unknown>

/** Rutas que muestran estas entidades y hay que refrescar tras un cambio. */
const RUTAS = [
  '/admin/jerarquia', '/admin/curriculo', '/admin/competencias',
  '/admin/fuentes', '/admin/perfil-egreso', '/admin/crear', '/inicio',
]

function refrescar() {
  for (const r of RUTAS) revalidatePath(r)
}

/**
 * ¿Esta fila está dentro de lo que el perfil puede tocar?
 *
 * El administrador toca todo. Un coordinador sólo lo que cuelga de su
 * programa; un docente, lo que cuelga de su curso. Sin esta comprobación,
 * conocer el id de un programa ajeno bastaría para renombrarlo.
 */
async function enAlcance(
  entidad: Entidad,
  fila: Fila,
  alcance: Alcance
): Promise<boolean> {
  if (alcance.rol === 'admin') return true
  if (!entidad.alcance) return false

  if (entidad.alcance === 'universidad_id') {
    const uid = entidad.tabla === 'universidades' ? Number(fila.id) : Number(fila.universidad_id)
    return alcance.universidadIds === null || alcance.universidadIds.includes(uid)
  }

  if (entidad.alcance === 'programa_id') {
    const pid = entidad.tabla === 'programas' ? Number(fila.id) : Number(fila.programa_id)
    return alcance.programaIds === null || alcance.programaIds.includes(pid)
  }

  // Un resultado de aprendizaje cuelga de programa, área o curso según su
  // ámbito. Se mira cuál trae la fila y se aplica la regla de ese nivel.
  // Un docente sólo alcanza los de curso: los de programa y área no son
  // suyos aunque su curso pertenezca a ese programa.
  if (entidad.alcance === 'por_ambito') {
    if (fila.programa_id != null) {
      if (alcance.cursoIds !== null) return false
      return alcance.programaIds === null || alcance.programaIds.includes(Number(fila.programa_id))
    }
    if (fila.area_id != null) {
      if (alcance.cursoIds !== null) return false
      if (alcance.programaIds === null) return true
      const db = clienteServidor()
      const { data: area } = await db
        .from('areas').select('programa_id').eq('id', Number(fila.area_id)).maybeSingle()
      return area?.programa_id != null && alcance.programaIds.includes(Number(area.programa_id))
    }
    if (fila.curso_id == null) return false
    // Cae al bloque de curso con el curso_id de la fila.
  }

  // curso_id: el docente se ciñe por curso; el coordinador, por el
  // programa al que pertenece ese curso.
  const cid = entidad.tabla === 'cursos' ? Number(fila.id) : Number(fila.curso_id)

  if (alcance.cursoIds !== null) return alcance.cursoIds.includes(cid)
  if (alcance.programaIds === null) return true

  const db = clienteServidor()
  const { data: curso } = await db
    .from('cursos').select('programa_id').eq('id', cid).maybeSingle()

  return curso?.programa_id != null && alcance.programaIds.includes(Number(curso.programa_id))
}

/** Carga la fila y comprueba permisos. Devuelve el error listo, si lo hay. */
async function autorizar(
  tabla: string,
  id: number
): Promise<{ entidad: Entidad; fila: Fila; alcance: Alcance } | { error: string }> {
  const entidad = entidadDe(tabla)
  if (!entidad) return { error: 'Esta entidad no admite cambios desde la aplicación.' }

  const { perfil, alcance } = await exigirSesion()
  if (!entidad.roles.includes(perfil.rol)) {
    return { error: `Tu perfil no puede modificar ${entidad.etiqueta}.` }
  }

  const db = clienteServidor()
  const { data, error } = await db.from(tabla).select('*').eq('id', id).maybeSingle()

  if (error) {
    if (faltaMigracion(error.code)) {
      return { error: 'Falta aplicar la migración que crea esta tabla.' }
    }
    return { error: `No se pudo leer: ${error.message}` }
  }
  if (!data) return { error: 'El registro ya no existe.' }

  const fila = data as unknown as Fila
  if (!(await enAlcance(entidad, fila, alcance))) {
    return { error: `${entidad.etiqueta} está fuera de tu alcance.` }
  }

  return { entidad, fila, alcance }
}

/**
 * Edita los campos permitidos de una fila.
 *
 * Sólo se tocan las columnas declaradas en la lista blanca, y sólo las
 * que vienen en el formulario: un campo ausente no se borra, se deja como
 * está. Así un formulario parcial no vacía columnas por accidente.
 */
export async function editarEntidad(
  _previo: EstadoEntidad,
  formulario: FormData
): Promise<EstadoEntidad> {
  const tabla = String(formulario.get('tabla') ?? '')
  const id = Number(formulario.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { error: 'Registro no válido.' }

  const auth = await autorizar(tabla, id)
  if ('error' in auth) return auth
  const { entidad } = auth

  const cambios: Fila = {}
  for (const campo of entidad.campos) {
    const crudo = formulario.get(campo.columna)
    if (crudo === null) continue

    const v = validarCampo(campo, String(crudo))
    if ('error' in v) return { error: v.error }
    cambios[campo.columna] = v.valor
  }

  if (Object.keys(cambios).length === 0) return { error: 'No hay nada que guardar.' }

  const db = clienteServidor()
  const { error } = await db.from(tabla).update(cambios).eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: `Ya existe ${entidad.etiqueta} con ese código o nombre.` }
    }
    if (error.code === '23514') {
      return { error: 'Algún valor no cumple las reglas de la tabla.' }
    }
    return { error: `No se pudo guardar: ${error.message}` }
  }

  refrescar()
  return { ok: 'Cambios guardados.' }
}

/**
 * Elimina una fila, sólo si nada depende de ella.
 *
 * Se cuentan los dependientes ANTES de intentar borrar, para poder decir
 * exactamente qué lo impide: «tiene 12 estudiantes y 3 grupos» es
 * accionable; «violación de clave foránea» no. Si la entidad admite
 * desactivarse, se sugiere esa vía.
 */
export async function eliminarEntidad(
  _previo: EstadoEntidad,
  formulario: FormData
): Promise<EstadoEntidad> {
  const tabla = String(formulario.get('tabla') ?? '')
  const id = Number(formulario.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { error: 'Registro no válido.' }

  // Doble confirmación: el botón de borrar primero muestra el aviso y
  // sólo el segundo envío trae este testigo.
  if (formulario.get('confirmado') !== '1') {
    return { error: 'Confirma la eliminación.' }
  }

  const auth = await autorizar(tabla, id)
  if ('error' in auth) return auth
  const { entidad, fila } = auth

  const db = clienteServidor()

  const conteos = await Promise.all(
    entidad.dependientes.map(async (d) => {
      const { count, error } = await db
        .from(d.tabla)
        .select('*', { count: 'exact', head: true })
        .eq(d.columna, id)
      // Una tabla dependiente sin migrar no tiene filas que proteger.
      return { etiqueta: d.etiqueta, cuantos: error ? 0 : (count ?? 0) }
    })
  )

  const bloqueo = describirDependientes(conteos)
  if (bloqueo) {
    return {
      error:
        `No se puede eliminar ${entidad.etiqueta}: tiene ${bloqueo}. ` +
        (entidad.desactivable
          ? 'Desactívala en su lugar: deja de aparecer pero conserva su historial.'
          : 'Elimina primero lo que depende de ella.'),
    }
  }

  const { error } = await db.from(tabla).delete().eq('id', id)

  if (error) {
    // Alguna dependencia no catalogada: el borrado lo impide la base.
    if (error.code === '23503') {
      return {
        error:
          `No se puede eliminar ${entidad.etiqueta}: otros registros dependen de ella.` +
          (entidad.desactivable ? ' Desactívala en su lugar.' : ''),
      }
    }
    return { error: `No se pudo eliminar: ${error.message}` }
  }

  refrescar()
  return { ok: `${capitalizar(entidad.etiqueta)} «${String(fila[entidad.nombre] ?? id)}» eliminada.` }
}

/**
 * Activa o desactiva sin borrar.
 *
 * Es la vía para retirar algo que tiene historial: un curso con
 * estudiantes y evidencias no se puede borrar, pero sí dejar de mostrar.
 */
export async function alternarEntidad(formulario: FormData) {
  const tabla = String(formulario.get('tabla') ?? '')
  const id = Number(formulario.get('id'))
  if (!Number.isInteger(id) || id <= 0) return

  const auth = await autorizar(tabla, id)
  if ('error' in auth) return
  const { entidad, fila } = auth
  if (!entidad.desactivable) return

  const db = clienteServidor()
  await db.from(tabla).update({ activo: !Boolean(fila.activo) }).eq('id', id)

  refrescar()
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
