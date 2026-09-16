import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'
import { resolverJerarquia } from '@/lib/kpi/indicadores'
import { aplicarFiltros, alcanceVacio, type Alcance } from '@/lib/auth/alcance'
import { COMPETENCIAS } from './catalogo'

/**
 * Filtros de la barra lateral.
 *
 * El estado vive en la URL como query params, para que un tablero filtrado
 * sea compartible por enlace. Las opciones se construyen a partir del
 * alcance del perfil y son encadenadas: elegir universidad reduce programa
 * y curso.
 *
 * Lo pedido nunca amplía lo permitido: aplicarFiltros() intersecta contra
 * el alcance, así que forzar un curso ajeno en la URL no devuelve nada.
 */

export interface Seleccion {
  universidad?: string
  programa?: string
  grupo?: string
  curso?: string
  competencia?: string
  ilo?: string
  tipoActividad?: string
  semana?: string
}

export interface Opcion {
  valor: string
  etiqueta: string
}

export interface Filtro {
  clave: keyof Seleccion
  etiqueta: string
  opciones: Opcion[]
  /** Preseleccionado y bloqueado: el docente no cambia de curso. */
  fijo: boolean
  seleccionado: string
}

export interface FiltrosResueltos {
  /** Para pintar la barra lateral. */
  controles: Filtro[]
  /** Alcance ya intersecado con lo que el usuario eligió. */
  alcance: Alcance
  /** Semanas del ámbito; null = todas. */
  semanas: number[] | null
  competencia: string | null
  ilo: string | null
  tipoActividad: string | null
}

const TODAS = ''

function leer(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '')
}

/** Convierte los searchParams de Next en una selección tipada. */
export function seleccionDe(
  params: Record<string, string | string[] | undefined>
): Seleccion {
  return {
    universidad: leer(params.universidad),
    programa: leer(params.programa),
    grupo: leer(params.grupo),
    curso: leer(params.curso),
    competencia: leer(params.competencia),
    ilo: leer(params.ilo),
    tipoActividad: leer(params.actividad),
    semana: leer(params.semana),
  }
}

/**
 * Construye los siete filtros y devuelve el alcance ya restringido.
 * Encadenados: las opciones de cada filtro dependen de lo elegido antes.
 */
export async function resolverFiltros(
  alcance: Alcance,
  seleccion: Seleccion
): Promise<FiltrosResueltos> {
  const db = clienteServidor()

  // ---------- Universidades y programas del alcance ----------
  let qu = db.from('universidades').select('id, codigo, universidad, programa').order('codigo')
  if (alcance.universidadIds !== null) qu = qu.in('id', alcance.universidadIds)
  const { data: univ } = await qu
  const universidades = (univ ?? []).map((u) => ({
    id: Number(u.id), codigo: String(u.codigo),
    nombre: String(u.universidad), programa: String(u.programa),
  }))

  // ---------- Cursos del alcance ----------
  let qc = db.from('cursos').select('id, codigo, nombre, universidad_id').order('codigo')
  if (alcance.universidadIds !== null) qc = qc.in('universidad_id', alcance.universidadIds)
  if (alcance.cursoIds !== null) qc = qc.in('id', alcance.cursoIds)
  const { data: cur } = await qc
  const cursos = (cur ?? []).map((c) => ({
    id: Number(c.id), codigo: String(c.codigo),
    nombre: String(c.nombre), universidadId: Number(c.universidad_id),
  }))

  // ---------- Encadenado: universidad -> programa -> curso ----------
  const uniSel = universidades.find((u) => u.codigo === seleccion.universidad)
  const trasUniversidad = uniSel ? universidades.filter((u) => u.id === uniSel.id) : universidades

  const programas = [...new Set(trasUniversidad.map((u) => u.programa))].sort()
  const progSel = seleccion.programa && programas.includes(seleccion.programa)
    ? seleccion.programa : ''

  const idsUniVisibles = trasUniversidad
    .filter((u) => !progSel || u.programa === progSel)
    .map((u) => u.id)

  const cursosVisibles = cursos.filter((c) => idsUniVisibles.includes(c.universidadId))
  const cursoSel = cursosVisibles.find((c) => c.codigo === seleccion.curso)

  // ---------- Encadenado: curso -> grupo ----------
  // Los grupos son secciones del curso. Si la migración 08 no está
  // aplicada, la consulta falla y la lista queda vacía: el filtro
  // simplemente no aparece y todo lo demás sigue funcionando.
  const idsCursoVisible = cursosVisibles.map((c) => c.id)
  const gruposRes = idsCursoVisible.length
    ? await db.from('grupos')
        .select('id, codigo, nombre, curso_id')
        .in('curso_id', cursoSel ? [cursoSel.id] : idsCursoVisible)
        .order('codigo')
    : { data: [] as Record<string, unknown>[], error: null }

  const gruposVisibles = (gruposRes.error ? [] : (gruposRes.data ?? [])).map((g) => ({
    id: Number(g.id), codigo: String(g.codigo),
    nombre: String(g.nombre), cursoId: Number(g.curso_id),
  }))
  const grupoSel = gruposVisibles.find((g) => g.codigo === seleccion.grupo)

  // ---------- Tipos de actividad e ILOs del ámbito ----------
  const idsCurso = cursosVisibles.map((c) => c.id)
  const [tiposRes, ilosRes] = await Promise.all([
    idsCurso.length
      ? db.from('actividades').select('tipo').in('curso_id', idsCurso)
      : Promise.resolve({ data: [] as { tipo: string }[] }),
    idsCurso.length
      ? db.from('resultados_aprendizaje').select('ilo').in('curso_id', idsCurso)
      : Promise.resolve({ data: [] as { ilo: string }[] }),
  ])
  const tipos = [...new Set((tiposRes.data ?? []).map((t) => String(t.tipo)))].sort()
  const ilos = [...new Set((ilosRes.data ?? []).map((r) => String(r.ilo)))].sort()

  // ---------- El docente ve su curso fijo y bloqueado ----------
  const cursoFijo = alcance.rol === 'docente' && cursos.length === 1
  const universidadFija = alcance.universidadIds !== null && universidades.length === 1

  const opciones = (vals: Opcion[], todas = 'Todas'): Opcion[] =>
    [{ valor: TODAS, etiqueta: todas }, ...vals]

  const controles: Filtro[] = [
    {
      clave: 'universidad', etiqueta: 'Universidad', fijo: universidadFija,
      seleccionado: universidadFija ? universidades[0]?.codigo ?? '' : (uniSel?.codigo ?? TODAS),
      opciones: universidadFija
        ? universidades.map((u) => ({ valor: u.codigo, etiqueta: u.nombre }))
        : opciones(universidades.map((u) => ({ valor: u.codigo, etiqueta: u.nombre }))),
    },
    {
      clave: 'programa', etiqueta: 'Programa', fijo: programas.length === 1,
      seleccionado: programas.length === 1 ? programas[0] : progSel,
      opciones: programas.length === 1
        ? programas.map((p) => ({ valor: p, etiqueta: p }))
        : opciones(programas.map((p) => ({ valor: p, etiqueta: p }))),
    },
    {
      clave: 'curso', etiqueta: 'Curso', fijo: cursoFijo,
      seleccionado: cursoFijo ? cursos[0].codigo : (cursoSel?.codigo ?? TODAS),
      opciones: cursoFijo
        ? cursos.map((c) => ({ valor: c.codigo, etiqueta: c.nombre }))
        : opciones(cursosVisibles.map((c) => ({ valor: c.codigo, etiqueta: c.nombre }))),
    },
    ...(gruposVisibles.length > 0
      ? [{
          clave: 'grupo', etiqueta: 'Grupo', fijo: gruposVisibles.length === 1,
          seleccionado: gruposVisibles.length === 1
            ? gruposVisibles[0].codigo
            : (grupoSel?.codigo ?? TODAS),
          opciones: gruposVisibles.length === 1
            ? gruposVisibles.map((g) => ({ valor: g.codigo, etiqueta: g.nombre }))
            : opciones(gruposVisibles.map((g) => ({ valor: g.codigo, etiqueta: g.nombre }))),
        } as Filtro]
      : []),
    {
      clave: 'competencia', etiqueta: 'Competencia', fijo: false,
      seleccionado: seleccion.competencia ?? TODAS,
      opciones: opciones(COMPETENCIAS.map((c) => ({ valor: c, etiqueta: c }))),
    },
    {
      clave: 'ilo', etiqueta: 'Resultado de aprendizaje', fijo: false,
      seleccionado: seleccion.ilo ?? TODAS,
      opciones: opciones(ilos.map((i) => ({ valor: i, etiqueta: i })), 'Todos'),
    },
    {
      clave: 'tipoActividad', etiqueta: 'Tipo de actividad', fijo: false,
      seleccionado: seleccion.tipoActividad ?? TODAS,
      opciones: opciones(tipos.map((t) => ({ valor: t, etiqueta: t })), 'Todos'),
    },
    {
      clave: 'semana', etiqueta: 'Semana', fijo: false,
      seleccionado: seleccion.semana ?? TODAS,
      opciones: opciones(
        Array.from({ length: 6 }, (_, i) => ({
          valor: String(i + 1), etiqueta: `Semana ${i + 1}`,
        }))
      ),
    },
  ]

  // ---------- Alcance restringido por la selección ----------
  const cursosPedidos = cursoSel
    ? [cursoSel.id]
    : (uniSel || progSel ? cursosVisibles.map((c) => c.id) : null)

  const restringido = aplicarFiltros(alcance, {
    universidadIds: uniSel ? [uniSel.id] : (progSel ? idsUniVisibles : null),
    cursoIds: cursosPedidos,
    grupoIds: grupoSel ? [grupoSel.id] : null,
  })

  const semana = Number(seleccion.semana)
  const semanas = Number.isInteger(semana) && semana >= 1 && semana <= 6 ? [semana] : null

  // El motor no conoce grupo ni programa: se traducen a la lista de
  // estudiantes afectados antes de que las consultas los usen. Sin esto el
  // filtro de grupo se vería en pantalla pero no cambiaría ninguna cifra.
  const alcanceResuelto = await resolverJerarquia(restringido)

  return {
    controles,
    alcance: alcanceResuelto,
    semanas,
    competencia: seleccion.competencia || null,
    ilo: seleccion.ilo || null,
    tipoActividad: seleccion.tipoActividad || null,
  }
}

export { alcanceVacio }
