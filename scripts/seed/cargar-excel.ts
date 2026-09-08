/**
 * Carga idempotente del Excel de origen al esquema `atlas`.
 *
 * Orden de dependencia:
 *   universidades -> cursos -> usuarios -> actividades -> semanas
 *   -> hechos -> recomendaciones -> kpis heredados
 *
 * Idempotente: upsert por el código único de negocio. Reejecutar no duplica.
 */
import { join } from 'node:path'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  leerLibro, esPuntual, esGrupal, aNumero, aNumeroONulo, texto,
} from './excel'

config({ path: '.env.local' })

const RUTA = join(process.cwd(), 'datos', 'Base_Datos_ATLAS_Moodle_Datos_Ensayo.xlsx')

const url = process.env.SUPABASE_URL
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !clave) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const db = createClient(url, clave, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'atlas' },
})

/** Inserta en lotes; corta a la primera para no dejar carga a medias. */
async function upsert(tabla: string, filas: object[], onConflict: string) {
  if (filas.length === 0) return
  const LOTE = 500
  for (let i = 0; i < filas.length; i += LOTE) {
    const { error } = await db
      .from(tabla)
      .upsert(filas.slice(i, i + LOTE), { onConflict, ignoreDuplicates: false })
    if (error) throw new Error(`${tabla}: ${error.message}`)
  }
  console.log(`  ${tabla.padEnd(26)} ${filas.length}`)
}

async function mapaCodigoId(tabla: string, columna = 'codigo') {
  const m = new Map<string, number>()
  const LOTE = 1000
  for (let desde = 0; ; desde += LOTE) {
    const { data, error } = await db
      .from(tabla).select(`id, ${columna}`).range(desde, desde + LOTE - 1)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    const filas = (data ?? []) as unknown as Record<string, unknown>[]
    for (const f of filas) m.set(String(f[columna]), Number(f.id))
    if (filas.length < LOTE) break
  }
  return m
}

async function principal() {
  console.log(`Leyendo ${RUTA}\n`)
  const L = leerLibro(RUTA)

  // ---------- Dimensiones ----------
  console.log('Dimensiones')
  await upsert('universidades', L.universidades.map((u) => ({
    codigo: texto(u.ID_Universidad),
    universidad: texto(u.Universidad),
    programa: texto(u.Programa),
    modalidad: texto(u.Modalidad),
  })), 'codigo')

  const univ = await mapaCodigoId('universidades')

  // El Excel trae nombre real de curso ("Programación I"). Si faltara,
  // se usa el código como nombre y la columna queda lista para actualizarse.
  await upsert('cursos', L.cursos.map((c) => ({
    codigo: texto(c.ID_Curso),
    nombre: texto(c.Curso) || texto(c.ID_Curso),
    universidad_id: univ.get(texto(c.ID_Universidad))!,
    semanas: 6,
    periodo: null,
  })), 'codigo')

  const cursos = await mapaCodigoId('cursos')

  await upsert('semanas', Array.from({ length: 6 }, (_, i) => ({
    numero: i + 1, etiqueta: `Semana ${i + 1}`,
  })), 'numero')

  // No hay filas de docente en el origen: usuarios sólo trae estudiantes.
  // El modelo queda listo para recibirlos (rol = 'Docente'); no se inventan.
  await upsert('usuarios', L.usuarios.map((u) => ({
    codigo: texto(u.ID_Estudiante),
    nombre: texto(u.ID_Estudiante),   // el origen no trae nombre propio
    curso_id: cursos.get(texto(u.ID_Curso)) ?? null,
    universidad_id: univ.get(texto(u.ID_Universidad))!,
    rol: texto(u.Rol),
    semestre: aNumeroONulo(u.Semestre),
  })), 'codigo')

  const usuarios = await mapaCodigoId('usuarios')

  await upsert('actividades', L.actividades.map((a) => ({
    codigo: texto(a.ID_Actividad),
    curso_id: cursos.get(texto(a.ID_Curso))!,
    nombre: texto(a.Actividad),
    tipo: texto(a.Tipo),
    competencia: texto(a.Competencia),
    ilo: texto(a.ILO),
    peso: aNumero(a.Peso),
  })), 'codigo')

  // TRAMPA 2: evaluaciones referencia la actividad por NOMBRE, no por código.
  // La clave de unión es (curso, nombre); sólo por nombre multiplicaría x3.
  const actPorCursoNombre = new Map<string, number>()
  {
    const { data, error } = await db.from('actividades').select('id, curso_id, nombre')
    if (error) throw new Error(`actividades: ${error.message}`)
    for (const a of data ?? []) {
      actPorCursoNombre.set(`${a.curso_id}||${texto(a.nombre)}`, Number(a.id))
    }
  }

  // ---------- Hechos ----------
  console.log('\nHechos')
  await upsert('moodle_logs', L.moodleLogs.map((r) => ({
    usuario_id: usuarios.get(texto(r.ID_Estudiante))!,
    curso_id: cursos.get(texto(r.ID_Curso))!,
    semana: aNumero(r.Semana),
    accesos: aNumero(r.Accesos),
    minutos: aNumero(r.Minutos),
    recursos_consultados: aNumero(r.Recursos_Consultados),
    actividades_visitadas: aNumero(r.Actividades_Visitadas),
  })), 'usuario_id,semana')

  await upsert('foros', L.foros.map((r) => ({
    usuario_id: usuarios.get(texto(r.ID_Estudiante))!,
    curso_id: cursos.get(texto(r.ID_Curso))!,
    semana: aNumero(r.Semana),
    intervenciones: aNumero(r.Intervenciones),
    respuestas_emitidas: aNumero(r.Respuestas_Emitidas),
    respuestas_recibidas: aNumero(r.Respuestas_Recibidas),
    calidad_argumentativa: aNumeroONulo(r.Calidad_Argumentativa),
  })), 'usuario_id,semana')

  await upsert('colaboracion', L.colaboracion.map((r) => ({
    usuario_id: usuarios.get(texto(r.ID_Estudiante))!,
    curso_id: cursos.get(texto(r.ID_Curso))!,
    semana: aNumero(r.Semana),
    aportes: aNumero(r.Aportes),
    interacciones: aNumero(r.Interacciones),
    evaluacion_pares: aNumeroONulo(r.Evaluacion_Pares),
    rol_grupo: texto(r.Rol_Grupo) || null,
  })), 'usuario_id,semana')

  // `semana` va null a propósito: no existe en el origen. No se inventa.
  const evaluaciones = L.evaluaciones.map((r) => {
    const cursoId = cursos.get(texto(r.ID_Curso))!
    const actividadId = actPorCursoNombre.get(`${cursoId}||${texto(r.Actividad)}`)
    if (!actividadId) {
      throw new Error(
        `Evaluación sin actividad resoluble: curso ${texto(r.ID_Curso)}, ` +
          `actividad "${texto(r.Actividad)}"`
      )
    }
    return {
      usuario_id: usuarios.get(texto(r.ID_Estudiante))!,
      curso_id: cursoId,
      actividad_id: actividadId,
      semana: null,
      calificacion: aNumero(r.Calificacion),
      puntaje_maximo: aNumero(r.Puntaje_Maximo),
      entrega_puntual: esPuntual(r.Entrega_Puntual),   // TRAMPA 1
    }
  })
  await upsert('evaluaciones', evaluaciones, 'usuario_id,actividad_id')

  await upsert('resultados_aprendizaje', L.resultados.map((r) => ({
    usuario_id: usuarios.get(texto(r.ID_Estudiante))!,
    curso_id: cursos.get(texto(r.ID_Curso))!,
    semana: null,
    ilo: texto(r.ILO),
    competencia: texto(r.Competencia),
    logro_porcentaje: aNumero(r.Logro_Porcentaje),
    nivel: texto(r.Nivel) || null,
  })), 'usuario_id,ilo')

  // ---------- Recomendaciones ----------
  // TRAMPA 3: 'TODOS' en ID_Estudiante son grupales -> usuario_id null.
  console.log('\nRecomendaciones')
  await upsert('recomendaciones_ia', L.recomendaciones.map((r) => {
    const grupal = esGrupal(r.ID_Estudiante)
    return {
      codigo: texto(r.ID_Recomendacion),
      curso_id: cursos.get(texto(r.ID_Curso))!,
      usuario_id: grupal ? null : usuarios.get(texto(r.ID_Estudiante))!,
      tipo: grupal ? 'Grupal' : (texto(r.Tipo) || 'Individual'),
      competencia: texto(r.Competencia),
      nivel_actual: texto(r.Nivel_Actual),
      nivel_meta: texto(r.Nivel_Meta),
      brecha: aNumero(r.Brecha),
      recomendacion: texto(r.Recomendacion),
      estado: texto(r.Estado) || 'Pendiente de revisión docente',
      generada_por: 'origen-excel',
    }
  }), 'codigo')

  // ---------- Heredado: sólo validación, ningún visual lo lee ----------
  console.log('\nHeredado (no es fuente de verdad)')
  await upsert('kpis_competencias_origen', L.kpis.map((k) => ({
    usuario_codigo: texto(k.ID_Estudiante),
    curso_codigo: texto(k.ID_Curso),
    ite: aNumeroONulo(k.ITE), iau: aNumeroONulo(k.IAU), icom: aNumeroONulo(k.ICOM),
    ipc: aNumeroONulo(k.IPC), irp: aNumeroONulo(k.IRP), ctg: aNumeroONulo(k.CTG),
  })), 'usuario_codigo')

  console.log('\nCarga completada.')
  console.log('Siguiente paso: ejecutar 04_seed_rubrica_parametros.sql')
}

principal().catch((e) => {
  console.error('\nError de carga:', e instanceof Error ? e.message : e)
  process.exit(1)
})
