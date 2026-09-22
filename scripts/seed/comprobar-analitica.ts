/**
 * Escenario de resultado conocido para la analítica.
 *
 * Reemplaza la red de seguridad que se perdió al sustituir el motor por
 * uno configurable: antes, cualquier error de cálculo rompía los valores
 * de referencia (CTG 73,4 %, embudo 36·36·36·24·11) y se veía enseguida.
 * Con un motor que se define en base de datos, esa comparación ya no
 * existe.
 *
 * Aquí se monta un escenario con resultado predecible, se comprueba que
 * la analítica lo clasifica como debe, y se limpia. Dos fallos reales
 * --el Conteo sin escala y las señales con ruido-- aparecieron haciendo
 * exactamente esto y no los detectó ninguna prueba unitaria.
 *
 *   npm run analitica
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false }, db: { schema: 'atlas' } }
)

type Fila = Record<string, unknown>

let fallos = 0

function comprobar(descripcion: string, condicion: boolean, detalle = '') {
  const marca = condicion ? 'OK  ' : 'FALLA'
  console.log(`  ${marca} ${descripcion}${detalle ? `  (${detalle})` : ''}`)
  if (!condicion) fallos++
}

async function principal() {
  console.log('\nESCENARIO DE ANALITICA\n')

  const { data: fuente } = await db
    .from('fuentes_datos').select('id').eq('codigo', 'OBSERVA').single()
  const { data: indGrupo } = await db
    .from('indicadores').select('id, nombre').eq('codigo', 'RP-VAL-I1').single()
  const { data: indIndiv } = await db
    .from('indicadores').select('id, nombre').eq('codigo', 'CE-CLA-I1').single()
  const { data: est } = await db
    .from('usuarios').select('id, codigo')
    .eq('curso_id', 1).eq('rol', 'Estudiante').order('id').limit(6)

  if (!fuente || !indGrupo || !indIndiv || !est || est.length < 6) {
    console.error('Falta configuracion. Aplica las migraciones 09 a 15.')
    process.exit(1)
  }

  // Dos patrones deliberadamente distintos:
  //   Validación  cinco de seis por debajo de 60  → dificultad DEL GRUPO
  //   Claridad    sólo el primero por debajo      → dificultad INDIVIDUAL
  //
  // Ambos indicadores son de tipo Promedio: son los que interpretan el
  // valor cargado. Un indicador de Conteo ignoraría el valor y contaría
  // evidencias, que es otra cosa.
  const valoresGrupo = [30, 35, 40, 45, 50, 85]
  const valoresIndiv = [25, 80, 85, 90, 88, 82]

  const filas: Fila[] = []
  est.forEach((e, n) => {
    filas.push({
      usuario_id: e.id, curso_id: 1, indicador_id: indGrupo.id,
      fuente_id: fuente.id, variable: 'validacion',
      valor: valoresGrupo[n], valor_bruto: valoresGrupo[n], semana: 3,
    })
    filas.push({
      usuario_id: e.id, curso_id: 1, indicador_id: indIndiv.id,
      fuente_id: fuente.id, variable: 'claridad',
      valor: valoresIndiv[n], valor_bruto: valoresIndiv[n], semana: 3,
    })
  })

  const { data: creadas, error: eIns } = await db
    .from('evidencias').insert(filas).select('id')

  if (eIns || !creadas) {
    console.error('No se pudieron cargar las evidencias:', eIns?.message)
    process.exit(1)
  }

  const ids = creadas.map((x) => Number(x.id))

  try {
    // ---------- Descriptiva ----------
    console.log('Descriptiva')
    const { data: desc } = await db.rpc('analitica_descriptiva', { p_semanas: null })
    const dDesc = ((desc ?? []) as Fila[]).filter((f) => Number(f.curso_id) === 1)

    comprobar('mide las dos dimensiones sembradas',
      new Set(dDesc.map((f) => String(f.dimension))).size >= 2)

    const dep = dDesc.find((f) =>
      String(f.dimension) === 'Validación' && Number(f.usuario_id) === est[0].id)
    comprobar('el valor del estudiante coincide con su evidencia',
      dep !== undefined && Math.abs(Number(dep.valor) - 30) < 0.01,
      dep ? `${Number(dep.valor).toFixed(1)} esperado 30` : 'sin fila')

    // ---------- Diagnóstica ----------
    console.log('\nDiagnostica')
    const { data: diag } = await db.rpc('analitica_diagnostica', { p_semanas: null })
    const dDiag = ((diag ?? []) as Fila[]).filter((f) => Number(f.curso_id) === 1)

    const grupales = dDiag.filter((f) =>
      String(f.dimension) === 'Validación' && String(f.tipo) === 'Dificultad del grupo')
    comprobar('lo que falla en casi todo el curso es dificultad DEL GRUPO',
      grupales.length >= 4, `${grupales.length} estudiantes`)

    const individual = dDiag.filter((f) =>
      String(f.dimension) === 'Claridad' && String(f.tipo) === 'Dificultad individual')
    comprobar('lo que falla en uno solo es dificultad INDIVIDUAL',
      individual.length === 1, `${individual.length} estudiante`)

    comprobar('no clasifica como individual lo que es del grupo',
      dDiag.filter((f) =>
        String(f.dimension) === 'Validación' &&
        String(f.tipo) === 'Dificultad individual').length === 0)

    // ---------- Predictiva ----------
    console.log('\nPredictiva')
    const { data: pred } = await db.rpc('analitica_predictiva', { p_semanas: null })
    const dPred = ((pred ?? []) as Fila[])
      .filter((f) => est.some((e) => e.id === Number(f.usuario_id)))

    const peor = dPred.find((f) => Number(f.usuario_id) === est[0].id)
    comprobar('el estudiante con dos dimensiones bajas sale en riesgo Alto',
      peor !== undefined && String(peor.riesgo) === 'Alto',
      peor ? String(peor.riesgo) : 'sin fila')

    const mejor = dPred.find((f) => Number(f.usuario_id) === est[5].id)
    comprobar('el estudiante sin dimensiones bajas no sale en riesgo',
      mejor !== undefined && String(mejor.riesgo) === 'Bajo',
      mejor ? String(mejor.riesgo) : 'sin fila')

    comprobar('toda alerta explica por que se marco',
      dPred.filter((f) => String(f.riesgo) !== 'Bajo')
        .every((f) => Array.isArray(f.senales) && (f.senales as string[]).length > 0))

    // El fallo que corrigió la migración 15: la cobertura se emitía como
    // señal de riesgo en todos los estudiantes y ahogaba a las demás.
    const conRuido = dPred.filter((f) => String(f.riesgo) === 'Bajo')
      .filter((f) => ((f.senales ?? []) as string[]).length > 0)
    comprobar('un estudiante sin riesgo no arrastra senales',
      conRuido.length === 0, `${conRuido.length} con senales`)

    comprobar('la cobertura se informa, para saber sobre cuanto se afirma',
      dPred.every((f) => f.cobertura !== undefined))

    // ---------- Dos implementaciones, mismo resultado ----------
    console.log('\nCoherencia')
    const bajasSegunDiag = new Map<number, number>()
    for (const f of dDiag) {
      if (Number(f.valor) >= 60) continue
      const u = Number(f.usuario_id)
      bajasSegunDiag.set(u, (bajasSegunDiag.get(u) ?? 0) + 1)
    }
    const coincide = dPred.every((f) =>
      Number(f.dimensiones_bajas) === (bajasSegunDiag.get(Number(f.usuario_id)) ?? 0))
    comprobar('predictiva y diagnostica cuentan lo mismo', coincide)

  } finally {
    await db.from('evidencias').delete().in('id', ids)
    const { count } = await db
      .from('evidencias').select('id', { count: 'exact', head: true })
    console.log(`\nLimpieza: quedan ${count ?? 0} evidencias.`)
  }

  if (fallos > 0) {
    console.log(`\n${fallos} COMPROBACION(ES) FALLIDA(S)\n`)
    process.exit(1)
  }
  console.log('\nANALITICA CORRECTA\n')
}

principal().catch((e) => {
  console.error(e)
  process.exit(1)
})
