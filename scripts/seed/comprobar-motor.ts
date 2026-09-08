/**
 * Comprueba el motor de indicadores replicando las fórmulas sobre los datos
 * reales, ANTES de confiar en las vistas SQL. Sirve de contraste independiente:
 * si las vistas y este script coinciden, y ambos dan los valores de referencia,
 * el motor está bien.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }, db: { schema: 'atlas' },
})

async function todas<T>(tabla: string, columnas: string): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select(columnas).range(desde, desde + 999)
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...((data ?? []) as unknown as T[]))
    if (!data || data.length < 1000) break
  }
  return filas
}

const media = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
const tope = (v: number) => Math.min(v, 100)

export async function calcular(semanas: number[] | null = null) {
  const [usuarios, cursos, foros, colab, logs, evals, ra, rubrica, criterios] =
    await Promise.all([
      todas<any>('usuarios', 'id, codigo, curso_id, universidad_id, rol'),
      todas<any>('cursos', 'id, codigo, semanas'),
      todas<any>('foros', 'usuario_id, semana, intervenciones, respuestas_emitidas, respuestas_recibidas, calidad_argumentativa'),
      todas<any>('colaboracion', 'usuario_id, curso_id, semana, aportes, interacciones, evaluacion_pares'),
      todas<any>('moodle_logs', 'usuario_id, semana, accesos, minutos, recursos_consultados'),
      todas<any>('evaluaciones', 'usuario_id, calificacion, puntaje_maximo, entrega_puntual'),
      todas<any>('resultados_aprendizaje', 'usuario_id, logro_porcentaje'),
      todas<any>('rubrica', 'usuario_id, semana, criterio_id, valor_obtenido, valor_maximo'),
      todas<any>('rubrica_criterios', 'id, codigo_kpi'),
    ])

  const estudiantes = usuarios.filter((u) => u.rol === 'Estudiante')
  const semanasCurso = new Map(cursos.map((c) => [c.id, Number(c.semanas)]))
  const codigoCriterio = new Map(criterios.map((c) => [c.id, c.codigo_kpi]))
  const enAmbito = (s: number) => semanas === null || semanas.includes(Number(s))

  // Aportes totales por curso, dentro del ámbito de semanas.
  const aportesCurso = new Map<number, number>()
  for (const c of colab) {
    if (!enAmbito(c.semana)) continue
    aportesCurso.set(c.curso_id, (aportesCurso.get(c.curso_id) ?? 0) + Number(c.aportes))
  }

  const porEstudiante = estudiantes.map((u) => {
    const sc = semanasCurso.get(u.curso_id) ?? 6
    const nAmbito = semanas === null ? sc : semanas.length
    const f = nAmbito / sc                        // regla 3: prorrateo

    const fo = foros.filter((x) => x.usuario_id === u.id && enAmbito(x.semana))
    const cl = colab.filter((x) => x.usuario_id === u.id && enAmbito(x.semana))
    const lg = logs.filter((x) => x.usuario_id === u.id && enAmbito(x.semana))
    const ev = evals.filter((x) => x.usuario_id === u.id)   // sin semana en origen
    const rr = ra.filter((x) => x.usuario_id === u.id)
    const rb = rubrica.filter((x) => x.usuario_id === u.id && enAmbito(x.semana))

    const s = (a: any[], k: string) => a.reduce((t, x) => t + Number(x[k]), 0)

    const interacciones = s(cl, 'interacciones')
    const intervenciones = s(fo, 'intervenciones')

    // Trabajo en Equipo
    // Sin ninguna interacción ni intervención no hay proporción que calcular
    // (0/0). Se cuenta como 0, no como NaN: en el conjunto completo no ocurre,
    // pero al filtrar una sola semana sí hay estudiantes sin actividad.
    const totalInteraccion = interacciones + intervenciones
    const icol = totalInteraccion === 0 ? 0 : (100 * interacciones) / totalInteraccion
    const tpi = tope(100 * intervenciones / (18 * f))
    const rip = tope(100 * (s(fo, 'respuestas_emitidas') + s(fo, 'respuestas_recibidas')) / (12 * f))
    const ncg = tope(100 * s(cl, 'aportes') / (aportesCurso.get(u.curso_id) ?? 1))
    const ta = tope(100 * s(cl, 'aportes') / (22 * f))

    // Aprendizaje Autónomo
    const fa = tope(100 * s(lg, 'accesos') / (60 * f))
    const te = tope(100 * s(lg, 'minutos') / (1500 * f))
    const upr = tope(100 * s(lg, 'recursos_consultados') / (48 * f))
    const cpp = tope(100 * ev.filter((x) => x.entrega_puntual).length / 5)  // sin prorrateo
    const tps = tope(100 * new Set(lg.filter((x) => Number(x.accesos) > 0).map((x) => x.semana)).size / nAmbito)

    // Comunicación Efectiva
    // CLT y CRF son promedios: sin filas no hay media (se omiten con null).
    // NPA sin filas de foro sería 0/0.
    const clt = fo.length ? media(fo.map((x) => Number(x.calidad_argumentativa))) : 0
    const npa = fo.length
      ? (100 * fo.filter((x) => Number(x.calidad_argumentativa) >= 70).length) / fo.length
      : 0
    const cid = tope(100 * s(fo, 'respuestas_emitidas') / (15 * f))
    const crf = cl.length ? media(cl.map((x) => Number(x.evaluacion_pares))) : 0

    // Rúbrica
    const porCodigo = (cod: string) => {
      const filas = rb.filter((x) => codigoCriterio.get(x.criterio_id) === cod)
      const o = filas.reduce((t, x) => t + Number(x.valor_obtenido), 0)
      const m = filas.reduce((t, x) => t + Number(x.valor_maximo), 0)
      return m ? (100 * o) / m : NaN
    }
    const na = porCodigo('NA'), ns = porCodigo('NS')
    const ea = porCodigo('EA'), td = porCodigo('TD')
    const nia = porCodigo('NIA'), uea = porCodigo('UEA')

    // Resolución de Problemas
    const tra = ev.length
      ? (100 * ev.filter((x) => Number(x.calificacion) >= 70).length) / ev.length
      : 0
    const maximoEv = s(ev, 'puntaje_maximo')
    const dpa = maximoEv ? (100 * s(ev, 'calificacion')) / maximoEv : 0

    const ite = media([icol, tpi, rip, ncg, ta])
    const iau = media([fa, te, upr, cpp, tps])
    const icom = media([clt, npa, cid, crf])
    const ipc = media([na, ns, ea, td])
    const irp = media([nia, tra, uea, dpa])
    const ctg = media([ite, iau, icom, ipc, irp])

    const ilra = 100 * rr.filter((x) => Number(x.logro_porcentaje) >= 70).length / rr.length

    return { codigo: u.codigo, cursoId: u.curso_id, ite, iau, icom, ipc, irp, ctg, ilra,
             sub: { icol, tpi, rip, ncg, ta, fa, te, upr, cpp, tps, clt, npa, cid, crf,
                    na, ns, ea, td, nia, tra, uea, dpa } }
  })

  const prom = (k: 'ite'|'iau'|'icom'|'ipc'|'irp'|'ctg'|'ilra') =>
    media(porEstudiante.map((e) => e[k]))

  // Embudo
  const mitad = (id: number) => Math.ceil((semanasCurso.get(id) ?? 6) / 2)
  const activos = estudiantes.filter((u) =>
    new Set(logs.filter((l) => l.usuario_id === u.id && Number(l.accesos) > 0).map((l) => l.semana)).size
      >= mitad(u.curso_id)).length
  const sostenida = estudiantes.filter((u) =>
    new Set(foros.filter((x) => x.usuario_id === u.id && Number(x.intervenciones) > 0).map((x) => x.semana)).size
      >= mitad(u.curso_id)).length
  const logran = porEstudiante.filter((e) => e.ilra >= 60).length
  const desarrollan = porEstudiante.filter((e) => e.ctg >= 75).length

  return {
    porEstudiante,
    indices: { ite: prom('ite'), iau: prom('iau'), icom: prom('icom'),
               ipc: prom('ipc'), irp: prom('irp'), ctg: prom('ctg'), ilra: prom('ilra') },
    subIndicadores: Object.fromEntries(
      (Object.keys(porEstudiante[0].sub) as (keyof typeof porEstudiante[0]['sub'])[])
        .map((k) => [k, media(porEstudiante.map((e) => e.sub[k]))])
    ) as Record<string, number>,
    embudo: [estudiantes.length, activos, sostenida, logran, desarrollan],
  }
}

if (process.argv[1]?.includes('comprobar-motor')) {
  const REF: Record<string, number> = {
    ite: 66.7, iau: 83.6, icom: 74.9, ipc: 74.1, irp: 68.0, ctg: 73.4, ilra: 57.8,
  }
  calcular().then((r) => {
    console.log('INDICES (conjunto completo, sin filtros)\n')
    let ok = true
    for (const [k, esperado] of Object.entries(REF)) {
      const real = r.indices[k as keyof typeof r.indices]
      const bien = Math.abs(real - esperado) <= 0.1
      ok &&= bien
      console.log(`  ${k.toUpperCase().padEnd(5)} ${real.toFixed(2).padStart(7)}   referencia ${esperado.toFixed(1).padStart(5)}   ${bien ? 'OK' : 'DIFIERE'}`)
    }
    console.log('\nSUB-INDICADORES')
    const grupos: Record<string, string[]> = {
      'Trabajo en Equipo': ['icol','tpi','rip','ncg','ta'],
      'Aprendizaje Autonomo': ['fa','te','upr','cpp','tps'],
      'Comunicacion Efectiva': ['clt','npa','cid','crf'],
      'Pensamiento Critico': ['na','ns','ea','td'],
      'Resolucion de Problemas': ['nia','tra','uea','dpa'],
    }
    for (const [g, ks] of Object.entries(grupos)) {
      console.log(`  ${g}`)
      console.log('    ' + ks.map((k) => `${k.toUpperCase()}=${r.subIndicadores[k].toFixed(2)}`).join('  '))
    }
    const refEmbudo = [36, 36, 36, 24, 11]
    const okEmbudo = r.embudo.every((v, i) => v === refEmbudo[i])
    ok &&= okEmbudo
    console.log(`\nEMBUDO  ${r.embudo.join(' · ')}   referencia ${refEmbudo.join(' · ')}   ${okEmbudo ? 'OK' : 'DIFIERE'}`)
    console.log(ok ? '\nMOTOR CORRECTO' : '\nHAY DIFERENCIAS')
    if (!ok) process.exitCode = 1
  }).catch((e) => { console.error(e); process.exit(1) })
}
