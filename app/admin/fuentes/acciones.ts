'use server'

import { revalidatePath } from 'next/cache'
import { clienteServidor } from '@/lib/supabase/servidor'
import { exigirRol } from '@/lib/auth/sesion'
import { normalizar, type Transformacion } from '@/lib/evidencias/modelo'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

export interface EstadoFuente {
  error?: string
  ok?: string
  /** Detalle de una carga: qué entró y qué se rechazó. */
  resumen?: {
    leidas: number
    cargadas: number
    rechazadas: number
    errores: string[]
  }
}

const CODIGO = /^[A-Za-z0-9_-]{2,30}$/

const TRANSFORMACIONES = ['Directo', 'Escalar', 'Normalizar', 'Booleano']

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
  'Falta la capa de evidencias. Aplica supabase/migraciones/11_evidencias.sql ' +
  'y 12_motor_evidencias.sql desde el SQL Editor.'

// ---------- Fuentes ----------

export async function crearFuente(
  _previo: EstadoFuente,
  formulario: FormData
): Promise<EstadoFuente> {
  await exigirRol(['admin'])

  const codigo = texto(formulario.get('codigo')).toUpperCase()
  const nombre = texto(formulario.get('nombre'))
  const categoria = texto(formulario.get('categoria'))
  const modoIngreso = texto(formulario.get('modo_ingreso'))
  const descripcion = texto(formulario.get('descripcion'))

  if (!CODIGO.test(codigo)) return { error: 'Código no válido.' }
  if (nombre.length < 2) return { error: 'El nombre de la fuente es obligatorio.' }

  const db = clienteServidor()
  const { error } = await db.from('fuentes_datos').insert({
    codigo, nombre, categoria, modo_ingreso: modoIngreso,
    descripcion: descripcion || null,
  })

  if (error) {
    if (faltaMigracion(error.code)) return { error: AVISO }
    if (error.code === '23505') return { error: `Ya existe una fuente con código ${codigo}.` }
    return { error: `No se pudo crear: ${error.message}` }
  }

  revalidatePath('/admin/fuentes')
  return { ok: `Fuente ${nombre} creada.` }
}

export async function alternarFuente(formulario: FormData) {
  await exigirRol(['admin'])
  const id = numeroONulo(formulario.get('id'))
  if (id === null) return
  const activo = String(formulario.get('activo')) === 'true'

  const db = clienteServidor()
  await db.from('fuentes_datos').update({ activo: !activo }).eq('id', id)
  revalidatePath('/admin/fuentes')
}

// ---------- Mapeos ----------

/**
 * Declara que una variable de una fuente alimenta un indicador.
 *
 * Es lo que permite añadir una herramienta sin tocar la arquitectura:
 *   GitHub · contribuciones → Participación → Trabajo en Equipo
 */
export async function crearMapeo(
  _previo: EstadoFuente,
  formulario: FormData
): Promise<EstadoFuente> {
  await exigirRol(['admin'])

  const fuenteId = numeroONulo(formulario.get('fuente_id'))
  const indicadorId = numeroONulo(formulario.get('indicador_id'))
  const variable = texto(formulario.get('variable'))
  const transformacion = texto(formulario.get('transformacion')) || 'Directo'
  const factor = numeroONulo(formulario.get('factor'))
  const valorMaximo = numeroONulo(formulario.get('valor_maximo'))
  const cursoId = numeroONulo(formulario.get('curso_id'))

  if (fuenteId === null) return { error: 'Selecciona una fuente.' }
  if (indicadorId === null) return { error: 'Selecciona un indicador.' }
  if (variable.length < 1) return { error: 'Indica qué variable de la fuente se usa.' }
  if (!TRANSFORMACIONES.includes(transformacion)) return { error: 'Transformación no válida.' }

  // Sin esto el mapeo se guardaría y luego produciría valores nulos sin
  // que nadie supiera por qué.
  if (transformacion === 'Escalar' && factor === null) {
    return { error: 'Escalar necesita un factor: es por cuánto se multiplica el valor.' }
  }
  if (transformacion === 'Normalizar' && (valorMaximo === null || valorMaximo === 0)) {
    return { error: 'Normalizar necesita un valor máximo distinto de cero.' }
  }

  const db = clienteServidor()
  const { error } = await db.from('mapeos').insert({
    fuente_id: fuenteId,
    indicador_id: indicadorId,
    variable,
    transformacion,
    factor,
    valor_maximo: valorMaximo,
    curso_id: cursoId,
  })

  if (error) {
    if (faltaMigracion(error.code)) return { error: AVISO }
    if (error.code === '23505') {
      return { error: 'Ya existe ese mapeo: el mismo dato entraría dos veces al indicador.' }
    }
    return { error: `No se pudo crear: ${error.message}` }
  }

  revalidatePath('/admin/fuentes')
  return { ok: `Mapeo creado: ${variable} alimenta el indicador.` }
}

export async function borrarMapeo(formulario: FormData) {
  await exigirRol(['admin'])
  const id = numeroONulo(formulario.get('id'))
  if (id === null) return

  const db = clienteServidor()
  await db.from('mapeos').delete().eq('id', id)
  revalidatePath('/admin/fuentes')
}

// ---------- Carga estructurada (opción B del punto 7) ----------

/** Una línea de CSV, respetando comillas dobles. */
function partirLinea(linea: string, separador: string): string[] {
  const campos: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      // Dos comillas seguidas dentro de un campo son una comilla literal.
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++ }
      else entreComillas = !entreComillas
    } else if (c === separador && !entreComillas) {
      campos.push(actual)
      actual = ''
    } else {
      actual += c
    }
  }
  campos.push(actual)
  return campos.map((c) => c.trim())
}

/**
 * Carga evidencias desde un CSV pegado.
 *
 * Es lo que permite usar ATLAS en una clase presencial sin LMS: el docente
 * pega lo que tenga --una planilla de observación, resultados de una
 * rúbrica, exportación de cualquier herramienta-- y queda registrado con
 * su trazabilidad.
 *
 * Columnas esperadas: estudiante, valor, y opcionalmente semana y maximo.
 * `estudiante` acepta el código (E001) o el id.
 *
 * TODO O NADA: si alguna fila falla, no se carga ninguna. Una carga a
 * medias dejaría los indicadores calculados sobre datos incompletos sin
 * que nadie lo notara.
 */
export async function cargarEvidencias(
  _previo: EstadoFuente,
  formulario: FormData
): Promise<EstadoFuente> {
  const { perfil } = await exigirRol(['admin', 'docente', 'coordinador'])

  const fuenteId = numeroONulo(formulario.get('fuente_id'))
  const indicadorId = numeroONulo(formulario.get('indicador_id'))
  const cursoId = numeroONulo(formulario.get('curso_id'))
  const contenido = String(formulario.get('csv') ?? '')
  const separador = texto(formulario.get('separador')) || ','
  const transformacion = (texto(formulario.get('transformacion')) || 'Directo') as Transformacion
  const factor = numeroONulo(formulario.get('factor'))
  const valorMaximoGlobal = numeroONulo(formulario.get('valor_maximo'))

  if (fuenteId === null) return { error: 'Selecciona la fuente de los datos.' }
  if (indicadorId === null) return { error: 'Selecciona qué indicador alimentan.' }
  if (cursoId === null) return { error: 'Selecciona el curso.' }

  const lineas = contenido.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lineas.length < 2) {
    return { error: 'Pega al menos una cabecera y una fila de datos.' }
  }

  const cabecera = partirLinea(lineas[0], separador).map((c) => c.toLowerCase())
  const iEst = cabecera.findIndex((c) => c === 'estudiante' || c === 'codigo')
  const iVal = cabecera.findIndex((c) => c === 'valor')
  const iSem = cabecera.findIndex((c) => c === 'semana')
  const iMax = cabecera.findIndex((c) => c === 'maximo' || c === 'máximo')

  if (iEst < 0) return { error: 'Falta la columna «estudiante» en la cabecera.' }
  if (iVal < 0) return { error: 'Falta la columna «valor» en la cabecera.' }

  const db = clienteServidor()

  // Los estudiantes del curso, para traducir código a id y para rechazar
  // los que no pertenecen: cargar la evidencia de un estudiante ajeno
  // contaminaría el indicador de otro curso.
  const { data: estudiantes, error: eEst } = await db
    .from('usuarios')
    .select('id, codigo')
    .eq('curso_id', cursoId)
    .eq('rol', 'Estudiante')

  if (eEst) {
    if (faltaMigracion(eEst.code)) return { error: AVISO }
    return { error: `No se pudieron leer los estudiantes: ${eEst.message}` }
  }

  const porCodigo = new Map(
    (estudiantes ?? []).map((e) => [String(e.codigo).toUpperCase(), Number(e.id)])
  )
  const porId = new Set((estudiantes ?? []).map((e) => Number(e.id)))

  const errores: string[] = []
  const filas: Record<string, unknown>[] = []

  for (let n = 1; n < lineas.length; n++) {
    const campos = partirLinea(lineas[n], separador)
    const ref = campos[iEst] ?? ''

    const usuarioId = porCodigo.get(ref.toUpperCase())
      ?? (porId.has(Number(ref)) ? Number(ref) : undefined)

    if (usuarioId === undefined) {
      errores.push(`Fila ${n + 1}: «${ref}» no es un estudiante de este curso.`)
      continue
    }

    const bruto = Number(campos[iVal])
    if (!Number.isFinite(bruto)) {
      errores.push(`Fila ${n + 1}: «${campos[iVal]}» no es un número.`)
      continue
    }

    const maximo = iMax >= 0 && campos[iMax] ? Number(campos[iMax]) : valorMaximoGlobal

    const valor = normalizar(bruto, {
      transformacion,
      factor,
      valorMaximo: maximo,
    })

    if (valor === null) {
      errores.push(`Fila ${n + 1}: no se pudo transformar el valor. Revisa factor o máximo.`)
      continue
    }

    let semana: number | null = null
    if (iSem >= 0 && campos[iSem]) {
      const s = Number(campos[iSem])
      if (!Number.isInteger(s) || s < 1) {
        errores.push(`Fila ${n + 1}: semana «${campos[iSem]}» no válida.`)
        continue
      }
      semana = s
    }

    filas.push({
      usuario_id: usuarioId,
      curso_id: cursoId,
      indicador_id: indicadorId,
      fuente_id: fuenteId,
      variable: cabecera[iVal],
      valor,
      valor_bruto: bruto,
      valor_maximo: maximo,
      semana,
      registrado_por: perfil.id,
    })
  }

  if (errores.length > 0) {
    return {
      error: `No se cargó nada: ${errores.length} de ${lineas.length - 1} filas tienen problemas.`,
      resumen: {
        leidas: lineas.length - 1,
        cargadas: 0,
        rechazadas: errores.length,
        errores: errores.slice(0, 10),
      },
    }
  }

  // El lote deja rastro de la carga, para poder auditarla o revertirla.
  const { data: lote } = await db
    .from('lotes_carga')
    .insert({
      fuente_id: fuenteId,
      curso_id: cursoId,
      nombre_archivo: texto(formulario.get('nombre_archivo')) || 'pegado',
      estado: 'Procesando',
      filas_leidas: lineas.length - 1,
      cargado_por: perfil.id,
    })
    .select()
    .maybeSingle()

  const loteId = lote ? Number(lote.id) : null

  const { error } = await db
    .from('evidencias')
    .insert(filas.map((f) => ({ ...f, lote_id: loteId })))

  if (error) {
    if (loteId !== null) {
      await db.from('lotes_carga').update({
        estado: 'Fallido',
        errores: { mensaje: error.message },
        terminado_en: new Date().toISOString(),
      }).eq('id', loteId)
    }
    if (faltaMigracion(error.code)) return { error: AVISO }
    return { error: `No se pudieron guardar las evidencias: ${error.message}` }
  }

  if (loteId !== null) {
    await db.from('lotes_carga').update({
      estado: 'Completado',
      filas_cargadas: filas.length,
      terminado_en: new Date().toISOString(),
    }).eq('id', loteId)
  }

  revalidatePath('/admin/fuentes')
  return {
    ok: `${filas.length} evidencias cargadas.`,
    resumen: { leidas: lineas.length - 1, cargadas: filas.length, rechazadas: 0, errores: [] },
  }
}

/**
 * Revierte una carga completa.
 *
 * Sin esto, un archivo mal mapeado quedaría mezclado con el resto de
 * evidencias y no habría forma de separarlo.
 */
export async function revertirLote(formulario: FormData) {
  await exigirRol(['admin'])
  const id = numeroONulo(formulario.get('id'))
  if (id === null) return

  const db = clienteServidor()
  await db.from('evidencias').delete().eq('lote_id', id)
  await db.from('lotes_carga').update({ estado: 'Revertido' }).eq('id', id)

  revalidatePath('/admin/fuentes')
}
