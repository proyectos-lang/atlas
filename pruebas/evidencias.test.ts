import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizar } from '@/lib/evidencias/modelo'

/**
 * La capa de integración y normalización.
 *
 * `normalizar()` es el punto por donde pasa todo dato de toda fuente antes
 * de convertirse en evidencia. Un error aquí contamina los indicadores sin
 * dejar rastro, así que se prueba caso por caso.
 */

describe('normalización: cada fuente entra con la misma forma', () => {
  it('Directo usa el valor tal cual', () => {
    expect(normalizar(42, { transformacion: 'Directo', factor: null, valorMaximo: null })).toBe(42)
    expect(normalizar(0, { transformacion: 'Directo', factor: null, valorMaximo: null })).toBe(0)
  })

  it('Escalar multiplica por el factor', () => {
    expect(normalizar(5, { transformacion: 'Escalar', factor: 20, valorMaximo: null })).toBe(100)
    expect(normalizar(3, { transformacion: 'Escalar', factor: 0.5, valorMaximo: null })).toBe(1.5)
  })

  it('Escalar sin factor no inventa un valor', () => {
    // Devolver el bruto sería peor que no devolver nada: el indicador
    // quedaría calculado sobre una escala que nadie declaró.
    expect(normalizar(5, { transformacion: 'Escalar', factor: null, valorMaximo: null })).toBeNull()
  })

  it('Normalizar convierte a porcentaje sobre el máximo', () => {
    expect(normalizar(7, { transformacion: 'Normalizar', factor: null, valorMaximo: 10 })).toBe(70)
    expect(normalizar(10, { transformacion: 'Normalizar', factor: null, valorMaximo: 10 })).toBe(100)
    expect(normalizar(0, { transformacion: 'Normalizar', factor: null, valorMaximo: 10 })).toBe(0)
  })

  it('Normalizar sin máximo, o con máximo cero, devuelve nulo', () => {
    // Dividir entre cero daría Infinity y contaminaría el promedio.
    expect(normalizar(7, { transformacion: 'Normalizar', factor: null, valorMaximo: null })).toBeNull()
    expect(normalizar(7, { transformacion: 'Normalizar', factor: null, valorMaximo: 0 })).toBeNull()
  })

  it('Booleano traduce cumplió / no cumplió a 100 y 0', () => {
    expect(normalizar(1, { transformacion: 'Booleano', factor: null, valorMaximo: null })).toBe(100)
    expect(normalizar(0, { transformacion: 'Booleano', factor: null, valorMaximo: null })).toBe(0)
  })

  it('Normalizar por encima del máximo no se trunca aquí', () => {
    // El truncamiento es decisión del INDICADOR, no de la normalización:
    // un indicador puede querer saber que alguien superó lo esperado.
    expect(normalizar(12, { transformacion: 'Normalizar', factor: null, valorMaximo: 10 })).toBe(120)
  })
})

describe('los ejemplos del modelo se pueden expresar', () => {
  it('GitHub: 4 errores corregidos sobre 5 esperados', () => {
    expect(normalizar(4, { transformacion: 'Normalizar', factor: null, valorMaximo: 5 })).toBe(80)
  })

  it('Rúbrica: nivel 3 de 4', () => {
    expect(normalizar(3, { transformacion: 'Normalizar', factor: null, valorMaximo: 4 })).toBe(75)
  })

  it('Moodle: entregó a tiempo', () => {
    expect(normalizar(1, { transformacion: 'Booleano', factor: null, valorMaximo: null })).toBe(100)
  })

  it('Forms: puntuación ya en escala 0-100', () => {
    expect(normalizar(85, { transformacion: 'Directo', factor: null, valorMaximo: null })).toBe(85)
  })
})

const sql = (archivo: string) =>
  readFileSync(join(process.cwd(), 'supabase', 'migraciones', archivo), 'utf8')

const soloCodigo = (texto: string) =>
  texto.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n')

const EVIDENCIAS = sql('11_evidencias.sql')
const MOTOR = sql('12_motor_evidencias.sql')
const EVIDENCIAS_SQL = soloCodigo(EVIDENCIAS)
const MOTOR_SQL = soloCodigo(MOTOR)

describe('ATLAS no depende de una plataforma', () => {
  it('el catálogo incluye fuentes de las siete categorías', () => {
    for (const cat of [
      'LMS', 'Colaborativa', 'Codigo', 'Formulario',
      'Instrumento', 'Observacion', 'Archivo',
    ]) {
      expect(EVIDENCIAS, cat).toContain(cat)
    }
  })

  it('hay fuentes que no requieren ninguna herramienta digital', () => {
    // Observación docente y rúbrica son lo que permite usar ATLAS en una
    // clase presencial sin nada más.
    expect(EVIDENCIAS).toContain('OBSERVA')
    expect(EVIDENCIAS).toContain('RUBRICA')
  })

  it('la migración aborta si todas las fuentes fueran LMS', () => {
    expect(EVIDENCIAS).toContain('seguiria atado a una plataforma')
  })

  it('están las herramientas del enunciado', () => {
    for (const f of ['MOODLE', 'CANVAS', 'BLACKBOARD', 'TEAMS', 'GITHUB', 'FORMS', 'MIRO']) {
      expect(EVIDENCIAS, f).toContain(f)
    }
  })
})

describe('la evidencia conserva su trazabilidad', () => {
  it('cada evidencia sabe de quién, de dónde y de qué indicador es', () => {
    for (const col of ['usuario_id', 'curso_id', 'indicador_id', 'fuente_id']) {
      expect(EVIDENCIAS_SQL, col).toContain(col)
    }
  })

  it('conserva el valor bruto además del transformado', () => {
    // Sin el bruto no se puede auditar la transformación ni rehacerla si
    // el mapeo cambia.
    expect(EVIDENCIAS_SQL).toContain('valor_bruto')
  })

  it('toda carga masiva deja rastro reversible', () => {
    expect(EVIDENCIAS_SQL).toContain('lotes_carga')
    expect(EVIDENCIAS_SQL).toContain('Revertido')
  })
})

describe('el motor nuevo conserva las cuatro reglas', () => {
  it('regla 2: trunca antes de que nadie promedie', () => {
    expect(MOTOR_SQL).toContain('least(v_valor, 100)')
  })

  it('regla 3: prorratea cuando el indicador lo declara', () => {
    expect(MOTOR_SQL).toContain('prorratea')
    expect(MOTOR_SQL).toContain('v_factor')
  })

  it('regla 4: los indicadores en puntos no se truncan', () => {
    expect(MOTOR_SQL).toContain("escala = 'Porcentaje'")
  })

  it('regla 1: devuelve una fila por estudiante, sin agregar', () => {
    expect(MOTOR_SQL).toContain('group by u.id')
  })

  it('sin evidencias no devuelve 0, devuelve nada', () => {
    // Un 0 afirmaría que el estudiante fue medido y obtuvo cero.
    expect(MOTOR_SQL).toContain('having count(e.id) > 0')
  })

  it('no toca el motor anterior', () => {
    for (const fn of ['kpi_estudiante', 'kpi_indice', 'kpi_ilo', 'kpi_embudo']) {
      expect(MOTOR_SQL.includes(`create or replace function atlas.${fn}`), fn).toBe(false)
    }
  })
})

describe('las migraciones son seguras de reejecutar', () => {
  it('no hay create table sin if not exists', () => {
    expect(EVIDENCIAS_SQL.match(/create table (?!if not exists)/g) ?? []).toEqual([])
  })

  it('la semilla de fuentes no pisa lo ya configurado', () => {
    const inserts = (EVIDENCIAS_SQL.match(/insert into/g) ?? []).length
    const conflictos = (EVIDENCIAS_SQL.match(/on conflict/g) ?? []).length
    expect(inserts).toBeGreaterThan(0)
    expect(conflictos).toBe(inserts)
  })

  it('no altera ninguna tabla de hechos del modelo anterior', () => {
    for (const t of ['atlas.foros', 'atlas.colaboracion', 'atlas.moodle_logs', 'atlas.rubrica']) {
      expect(EVIDENCIAS_SQL.includes(`alter table ${t}`), t).toBe(false)
      expect(EVIDENCIAS_SQL.includes(`drop table ${t}`), t).toBe(false)
    }
  })
})
