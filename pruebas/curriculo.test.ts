import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * El modelo curricular es sobre todo esquema SQL, así que lo que se puede
 * verificar sin base de datos son sus invariantes estructurales: que la
 * semilla cubra lo que el modelo de la investigación pide, y que la
 * migración no rompa lo que ya funciona.
 *
 * El comportamiento contra datos reales se verifica con la aplicación en
 * marcha, no aquí.
 */

const sql = (archivo: string) =>
  readFileSync(join(process.cwd(), 'supabase', 'migraciones', archivo), 'utf8')

const CURRICULO = sql('09_curriculo.sql')
const SEMILLA = sql('10_seed_competencias.sql')

/**
 * El SQL sin sus comentarios.
 *
 * Las migraciones explican por qué hacen lo que hacen, y esas
 * explicaciones NOMBRAN lo que no tocan --las funciones del motor, por
 * ejemplo--. Comprobar sobre el texto crudo daría falsos positivos.
 */
const soloCodigo = (texto: string) =>
  texto
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')

const CURRICULO_SQL = soloCodigo(CURRICULO)
const SEMILLA_SQL = soloCodigo(SEMILLA)

describe('el modelo curricular cubre los tres niveles', () => {
  it('macro: institución, facultad y datos del programa', () => {
    for (const tabla of ['instituciones', 'facultades', 'programas_macro']) {
      expect(CURRICULO, tabla).toContain(`atlas.${tabla}`)
    }
  })

  it('meso: áreas, líneas curriculares y ubicación de asignaturas', () => {
    for (const tabla of ['areas', 'lineas_curriculares', 'cursos_meso']) {
      expect(CURRICULO, tabla).toContain(`atlas.${tabla}`)
    }
  })

  it('micro: datos del curso y unidades', () => {
    for (const tabla of ['cursos_micro', 'unidades']) {
      expect(CURRICULO, tabla).toContain(`atlas.${tabla}`)
    }
  })

  it('competencia → dimensión → indicador', () => {
    for (const tabla of ['competencias', 'dimensiones', 'indicadores']) {
      expect(CURRICULO, tabla).toContain(`atlas.${tabla}`)
    }
  })
})

describe('la migración no rompe lo que ya funciona', () => {
  it('no altera ninguna tabla de hechos', () => {
    // Los datos de foros, colaboración, logs, evaluaciones, rúbrica y
    // resultados_aprendizaje alimentan el motor. Si la migración los
    // tocara, los indicadores cambiarían sin que nadie lo pidiera.
    const hechos = [
      'atlas.foros', 'atlas.colaboracion', 'atlas.moodle_logs',
      'atlas.evaluaciones', 'atlas.rubrica',
    ]
    for (const t of hechos) {
      expect(CURRICULO_SQL.includes(`alter table ${t}`), t).toBe(false)
      expect(CURRICULO_SQL.includes(`drop table ${t}`), t).toBe(false)
      expect(CURRICULO_SQL.includes(`delete from ${t}`), t).toBe(false)
    }
  })

  it('no toca las funciones del motor', () => {
    for (const fn of ['kpi_estudiante', 'kpi_indice', 'kpi_ilo', 'kpi_embudo']) {
      expect(CURRICULO_SQL.includes(fn), fn).toBe(false)
    }
  })

  it('es idempotente: todo se crea con if not exists o on conflict', () => {
    const creates = CURRICULO_SQL.match(/create table (?!if not exists)/g) ?? []
    expect(creates).toEqual([])
  })

  it('la semilla nunca pisa lo que alguien ya configuró', () => {
    // Es configuración editable: reejecutar la migración no debe deshacer
    // los cambios del docente.
    const inserts = (SEMILLA_SQL.match(/insert into/g) ?? []).length
    const conflictos = (SEMILLA_SQL.match(/on conflict/g) ?? []).length
    expect(inserts).toBeGreaterThan(0)
    expect(conflictos).toBe(inserts)
  })
})

describe('la semilla cubre las cinco competencias del modelo', () => {
  const COMPETENCIAS = [
    'Comunicación Efectiva', 'Pensamiento Crítico', 'Resolución de Problemas',
    'Trabajo en Equipo', 'Aprendizaje Autónomo',
  ]

  it('están las cinco', () => {
    for (const c of COMPETENCIAS) {
      expect(SEMILLA, c).toContain(c)
    }
  })

  it('resolución de problemas tiene sus siete dimensiones', () => {
    // Las que enumera el modelo de la investigación.
    const dims = [
      'Comprensión del problema', 'Descomposición', 'Generación de alternativas',
      'Implementación', 'Pruebas', 'Depuración', 'Validación',
    ]
    for (const d of dims) {
      expect(SEMILLA, d).toContain(d)
    }
  })

  it('trabajo en equipo tiene sus seis dimensiones', () => {
    const dims = [
      'Participación', 'Contribución', 'Responsabilidades',
      'Coordinación', 'Integración de aportes', 'Colaboración',
    ]
    for (const d of dims) {
      expect(SEMILLA, d).toContain(d)
    }
  })

  it('aprendizaje autónomo queda sin Student Outcome: es complementaria', () => {
    // Distinción del modelo: transversal que NO corresponde a un SO ABET.
    // Si alguien le asigna uno, esta prueba lo detecta.
    const bloque = SEMILLA.slice(
      SEMILLA.indexOf("('AA', 'Aprendizaje Autónomo'"),
      SEMILLA.indexOf('on conflict (codigo) do nothing')
    )
    expect(bloque).toContain('null')
  })

  it('las demás sí declaran su Student Outcome', () => {
    for (const so of ['SO3', 'SO1', 'SO5']) {
      expect(SEMILLA, so).toContain(so)
    }
  })
})

describe('los indicadores son configurables, no fórmulas fijas', () => {
  it('la tabla declara cómo se agrega cada indicador', () => {
    for (const a of ['Promedio', 'Suma', 'Proporcion', 'Conteo', 'Rubrica']) {
      expect(CURRICULO, a).toContain(a)
    }
  })

  it('una proporción necesita umbral y una suma valor esperado', () => {
    expect(CURRICULO).toContain('valor_esperado')
    expect(CURRICULO).toContain('umbral')
  })

  it('el truncamiento y el prorrateo son configurables por indicador', () => {
    // En el motor anterior eran decisiones cableadas en SQL.
    expect(CURRICULO).toContain('trunca_100')
    expect(CURRICULO).toContain('prorratea')
  })
})

describe('la migración se verifica a sí misma', () => {
  it('aborta si no se crean las 15 tablas', () => {
    expect(CURRICULO).toContain('raise exception')
    expect(CURRICULO).toContain('15 tablas')
  })

  it('la semilla aborta si una dimensión queda sin indicador', () => {
    // Una dimensión sin indicador no se puede medir, y el modelo quedaría
    // incompleto en silencio.
    expect(SEMILLA).toContain('dimensiones sin ningun indicador')
  })
})
