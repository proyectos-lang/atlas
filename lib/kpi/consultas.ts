import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'
import { alcanceVacio, type Alcance } from '@/lib/auth/alcance'

/**
 * Acceso a datos de negocio.
 *
 * Todas las funciones exigen un Alcance como PRIMER parámetro: no hay
 * ninguna firma que permita consultar sin él. El filtro se aplica siempre
 * en el servidor, así que una respuesta de API no puede contener filas
 * fuera del alcance aunque el cliente manipule la petición.
 */

/** Aplica el alcance a una consulta ya iniciada. */
function ceñir<T extends {
  in: (col: string, vals: readonly (string | number)[]) => T
}>(
  consulta: T,
  alcance: Alcance,
  columnas: {
    universidad?: string; programa?: string; curso?: string
    grupo?: string; usuario?: string
  }
): T {
  let q = consulta
  if (columnas.universidad && alcance.universidadIds !== null) {
    q = q.in(columnas.universidad, alcance.universidadIds)
  }
  if (columnas.programa && alcance.programaIds !== null) {
    q = q.in(columnas.programa, alcance.programaIds)
  }
  if (columnas.curso && alcance.cursoIds !== null) {
    q = q.in(columnas.curso, alcance.cursoIds)
  }
  if (columnas.grupo && alcance.grupoIds !== null) {
    q = q.in(columnas.grupo, alcance.grupoIds)
  }
  if (columnas.usuario && alcance.usuarioIds !== null) {
    q = q.in(columnas.usuario, alcance.usuarioIds)
  }
  return q
}

export interface Universidad {
  id: number; codigo: string; universidad: string
  programa: string; modalidad: string
}

export interface Curso {
  id: number; codigo: string; nombre: string
  universidadId: number; programaId: number | null; semanas: number
}

export interface Programa {
  id: number; codigo: string; nombre: string
  universidadId: number; modalidad: string | null
}

export interface Grupo {
  id: number; codigo: string; nombre: string
  cursoId: number; docenteId: number | null; periodo: string | null
}

export interface Estudiante {
  id: number; codigo: string; nombre: string
  cursoId: number | null; universidadId: number
  grupoId: number | null
}

export async function universidades(alcance: Alcance): Promise<Universidad[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()
  let q = db.from('universidades')
    .select('id, codigo, universidad, programa, modalidad')
    .order('codigo')
  q = ceñir(q, alcance, { universidad: 'id' })
  const { data, error } = await q
  if (error) throw new Error(`universidades: ${error.message}`)
  return (data ?? []).map((u) => ({
    id: Number(u.id), codigo: String(u.codigo),
    universidad: String(u.universidad), programa: String(u.programa),
    modalidad: String(u.modalidad),
  }))
}

export async function cursos(alcance: Alcance): Promise<Curso[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()
  let q = db.from('cursos')
    .select('id, codigo, nombre, universidad_id, programa_id, semanas')
    .order('codigo')
  q = ceñir(q, alcance, {
    universidad: 'universidad_id', programa: 'programa_id', curso: 'id',
  })
  const { data, error } = await q
  if (error) throw new Error(`cursos: ${error.message}`)
  return (data ?? []).map((c) => ({
    id: Number(c.id), codigo: String(c.codigo), nombre: String(c.nombre),
    universidadId: Number(c.universidad_id),
    programaId: c.programa_id == null ? null : Number(c.programa_id),
    semanas: Number(c.semanas),
  }))
}

export async function estudiantes(alcance: Alcance): Promise<Estudiante[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()
  let q = db.from('usuarios')
    .select('id, codigo, nombre, curso_id, universidad_id, grupo_id')
    .eq('rol', 'Estudiante')
    .order('codigo')
  q = ceñir(q, alcance, {
    universidad: 'universidad_id', curso: 'curso_id',
    grupo: 'grupo_id', usuario: 'id',
  })
  const { data, error } = await q
  if (error) throw new Error(`usuarios: ${error.message}`)
  return (data ?? []).map((u) => ({
    id: Number(u.id), codigo: String(u.codigo), nombre: String(u.nombre),
    cursoId: u.curso_id === null ? null : Number(u.curso_id),
    universidadId: Number(u.universidad_id),
    grupoId: u.grupo_id == null ? null : Number(u.grupo_id),
  }))
}

/** Conteos de la fila de tarjetas institucionales. */
export interface Conteos {
  cursos: number
  docentes: number
  estudiantes: number
  actividades: number
  ilos: number
  recomendacionesGeneradas: number
  recomendacionesImplementadas: number
  universidades: number
}

export async function conteos(alcance: Alcance): Promise<Conteos> {
  if (alcanceVacio(alcance)) {
    return {
      cursos: 0, docentes: 0, estudiantes: 0, actividades: 0, ilos: 0,
      recomendacionesGeneradas: 0, recomendacionesImplementadas: 0, universidades: 0,
    }
  }

  const db = clienteServidor()
  const listaCursos = await cursos(alcance)
  const idsCurso = listaCursos.map((c) => c.id)
  const listaUniv = await universidades(alcance)

  if (idsCurso.length === 0) {
    return {
      cursos: 0, docentes: 0, estudiantes: 0, actividades: 0, ilos: 0,
      recomendacionesGeneradas: 0, recomendacionesImplementadas: 0,
      universidades: listaUniv.length,
    }
  }

  /**
   * `porUsuario` indica si la tabla tiene una columna de estudiante que deba
   * ceñirse al alcance. Sin esto, un estudiante vería el conteo de todo su
   * curso mientras la lista muestra sólo su fila: dos cifras que se
   * contradicen en la misma pantalla.
   */
  const contar = async (
    tabla: string,
    opciones: { aplicar?: (q: any) => any; columnaUsuario?: string } = {}
  ): Promise<number> => {
    let q = db.from(tabla).select('*', { count: 'exact', head: true }).in('curso_id', idsCurso)
    if (opciones.columnaUsuario && alcance.usuarioIds !== null) {
      q = q.in(opciones.columnaUsuario, alcance.usuarioIds)
    }
    if (opciones.aplicar) q = opciones.aplicar(q)
    const { count, error } = await q
    if (error) throw new Error(`${tabla}: ${error.message}`)
    return count ?? 0
  }

  // No hay filas de docente en el origen: el conteo dará 0 y la tarjeta
  // debe decir "sin registros de docente", no fabricar un número.
  const [docentes, estudiantesN, actividades, generadas, implementadas] =
    await Promise.all([
      contar('usuarios', { aplicar: (q) => q.eq('rol', 'Docente'), columnaUsuario: 'id' }),
      contar('usuarios', { aplicar: (q) => q.eq('rol', 'Estudiante'), columnaUsuario: 'id' }),
      contar('actividades'),
      contar('recomendaciones_ia', { columnaUsuario: 'usuario_id' }),
      contar('recomendaciones_ia', {
        aplicar: (q) => q.eq('estado', 'Implementada'), columnaUsuario: 'usuario_id',
      }),
    ])

  let qIlos = db.from('resultados_aprendizaje').select('ilo').in('curso_id', idsCurso)
  if (alcance.usuarioIds !== null) qIlos = qIlos.in('usuario_id', alcance.usuarioIds)
  const { data: ilosData, error: eIlos } = await qIlos
  if (eIlos) throw new Error(`resultados_aprendizaje: ${eIlos.message}`)
  const ilos = new Set((ilosData ?? []).map((r) => String(r.ilo))).size

  return {
    cursos: listaCursos.length,
    docentes,
    estudiantes: estudiantesN,
    actividades,
    ilos,
    recomendacionesGeneradas: generadas,
    recomendacionesImplementadas: implementadas,
    universidades: listaUniv.length,
  }
}

/**
 * Programas del alcance.
 *
 * Nivel intermedio entre universidad y curso. Si la tabla no existe
 * todavía (migración 08 sin aplicar) devuelve lista vacía en vez de
 * romper: la jerarquía es aditiva y nada depende de ella para funcionar.
 */
export async function programas(alcance: Alcance): Promise<Programa[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()
  let q = db.from('programas')
    .select('id, codigo, nombre, universidad_id, modalidad')
    .order('codigo')
  q = ceñir(q, alcance, { universidad: 'universidad_id', programa: 'id' })
  const { data, error } = await q
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') return []
    throw new Error(`programas: ${error.message}`)
  }
  return (data ?? []).map((p) => ({
    id: Number(p.id), codigo: String(p.codigo), nombre: String(p.nombre),
    universidadId: Number(p.universidad_id),
    modalidad: p.modalidad == null ? null : String(p.modalidad),
  }))
}

/**
 * Grupos del alcance.
 *
 * Un grupo es una sección de un curso con su propio docente. El filtro por
 * curso se aplica aquí porque `grupos` no tiene universidad propia: la
 * hereda del curso, y ceñir por universidad requeriría un join.
 */
export async function grupos(alcance: Alcance): Promise<Grupo[]> {
  if (alcanceVacio(alcance)) return []
  const db = clienteServidor()
  let q = db.from('grupos')
    .select('id, codigo, nombre, curso_id, docente_id, periodo')
    .order('codigo')
  q = ceñir(q, alcance, { curso: 'curso_id', grupo: 'id' })
  const { data, error } = await q
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') return []
    throw new Error(`grupos: ${error.message}`)
  }
  return (data ?? []).map((g) => ({
    id: Number(g.id), codigo: String(g.codigo), nombre: String(g.nombre),
    cursoId: Number(g.curso_id),
    docenteId: g.docente_id == null ? null : Number(g.docente_id),
    periodo: g.periodo == null ? null : String(g.periodo),
  }))
}
