import { describe, it, expect } from 'vitest'
import { CATALOGO, nombreDe } from '@/lib/kpi/catalogo'
import {
  COMPETENCIAS_EXPLICADAS,
  ETAPAS_EMBUDO,
  EXPLICACIONES,
  REGLAS,
  explicacionDe,
} from '@/lib/kpi/metodologia'

/**
 * La página "Acerca de" transcribe el motor; el motor vive en SQL. Nada
 * puede garantizar automáticamente que la prosa describa bien la fórmula,
 * pero sí se puede impedir que la documentación se desincronice del
 * catálogo: que no falten indicadores, que no sobren códigos inventados
 * y que las banderas coincidan con lo que el catálogo declara.
 */

const codigosDocumentados = new Set(EXPLICACIONES.map((e) => e.codigo))

describe('la metodología documenta el catálogo', () => {
  it('cada explicación corresponde a un indicador real del catálogo', () => {
    const codigosCatalogo = new Set(CATALOGO.map((i) => i.codigo))
    const inventados = EXPLICACIONES.filter((e) => !codigosCatalogo.has(e.codigo))
    expect(inventados.map((e) => e.codigo)).toEqual([])
  })

  it('no hay explicaciones duplicadas', () => {
    expect(codigosDocumentados.size).toBe(EXPLICACIONES.length)
  })

  it('documenta los 22 sub-indicadores, los 5 índices y el global', () => {
    const debenEstar = CATALOGO.filter(
      (i) => i.nivel === 'Sub-KPI' || i.nivel === 'Índice' || i.nivel === 'Índice Global'
    )
      // Los indicadores del agente no describen al estudiante: miden el
      // ciclo de revisión docente y se explican en su propia pantalla.
      .filter((i) => i.estadoDato !== 'Sin fuente')

    const sinDocumentar = debenEstar.filter((i) => !codigosDocumentados.has(i.codigo))
    expect(sinDocumentar.map((i) => i.codigo)).toEqual([])
  })

  it('documenta los cuatro resultados de aprendizaje', () => {
    for (const cod of ['ILRA', 'TLC', 'IBA', 'NLA']) {
      expect(codigosDocumentados.has(cod), `falta ${cod}`).toBe(true)
    }
  })
})

describe('la metodología no contradice al catálogo', () => {
  it('sólo se documentan como truncados los que el motor trunca de verdad', () => {
    // El catálogo marca truncar100 en casi todos los sub-indicadores, pero el
    // motor sólo aplica `least(100, …)` a los que se dividen entre un valor
    // esperado, que es donde el estudiante puede superar lo previsto. Los
    // demás son proporciones sobre su propio total (o cocientes de rúbrica,
    // donde lo obtenido nunca excede el máximo): no pueden pasar de 100 y el
    // tope sobraría. Esta página describe el motor, no el catálogo.
    const TRUNCA_EL_MOTOR = new Set([
      'TPI', 'RIP', 'NCG', 'TA', 'FA', 'TE', 'UPR', 'CPP', 'TPS', 'CID',
    ])

    for (const e of EXPLICACIONES) {
      const delCatalogo = CATALOGO.find((i) => i.codigo === e.codigo)
      if (!delCatalogo || delCatalogo.nivel !== 'Sub-KPI') continue
      expect(e.trunca, `${e.codigo}: truncamiento`).toBe(TRUNCA_EL_MOTOR.has(e.codigo))
    }
  })

  it('cada indicador tiene nombre legible: nunca se muestra el código', () => {
    for (const e of EXPLICACIONES) {
      const nombre = nombreDe(e.codigo)
      expect(nombre, `${e.codigo} sin nombre`).toBeTruthy()
      expect(nombre).not.toBe(e.codigo)
    }
  })

  it('toda explicación tiene fórmula y origen no vacíos', () => {
    for (const e of EXPLICACIONES) {
      expect(e.queMide.length, `${e.codigo}: queMide`).toBeGreaterThan(20)
      expect(e.formula.length, `${e.codigo}: formula`).toBeGreaterThan(5)
      expect(e.origen.length, `${e.codigo}: origen`).toBeGreaterThan(5)
    }
  })
})

describe('la excepción de CPP queda documentada', () => {
  it('CPP no se prorratea', () => {
    expect(explicacionDe('CPP')?.prorratea).toBe(false)
  })

  it('los demás sub-indicadores con valor esperado sí se prorratean', () => {
    for (const cod of ['TPI', 'RIP', 'TA', 'FA', 'TE', 'UPR', 'CID']) {
      expect(explicacionDe(cod)?.prorratea, `${cod} debería prorratearse`).toBe(true)
    }
  })

  it('CPP lleva advertencia visible: es la excepción y hay que verla', () => {
    expect(explicacionDe('CPP')?.advertencia).toBeTruthy()
  })
})

describe('advertencias que no pueden perderse', () => {
  it('la brecha de aprendizaje avisa de que va en puntos y puede ser negativa', () => {
    const iba = explicacionDe('IBA')
    expect(iba?.advertencia).toMatch(/puntos/i)
    expect(iba?.advertencia).toMatch(/negativ/i)
  })

  it('los indicadores sin seguimiento semanal lo advierten', () => {
    for (const cod of ['TRA', 'DPA']) {
      expect(explicacionDe(cod)?.advertencia, `${cod}`).toMatch(/semana/i)
    }
  })

  it('RIP advierte de su saturación', () => {
    expect(explicacionDe('RIP')?.advertencia).toMatch(/tope|satur/i)
  })
})

describe('estructura de la página', () => {
  it('las cinco competencias están explicadas', () => {
    expect(COMPETENCIAS_EXPLICADAS).toHaveLength(5)
  })

  it('cada competencia lista sub-indicadores documentados', () => {
    for (const c of COMPETENCIAS_EXPLICADAS) {
      for (const cod of c.subIndicadores) {
        expect(codigosDocumentados.has(cod), `${c.competencia}: falta ${cod}`).toBe(true)
      }
    }
  })

  it('las cuatro reglas están, numeradas de 1 a 4', () => {
    expect(REGLAS.map((r) => r.numero)).toEqual([1, 2, 3, 4])
  })

  it('el embudo tiene cinco etapas con criterio', () => {
    expect(ETAPAS_EMBUDO).toHaveLength(5)
    for (const e of ETAPAS_EMBUDO) {
      expect(e.criterio.length, `etapa ${e.etapa}`).toBeGreaterThan(20)
    }
  })

  it('la etapa 5 documenta el umbral 75, coherente con el nivel Alto', () => {
    expect(ETAPAS_EMBUDO[4].criterio).toMatch(/75/)
  })
})
