import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ENTIDADES, entidadDe, validarCampo, describirDependientes, camposParaEditor,
} from '@/lib/admin/entidades'

/**
 * Edición y eliminación genéricas.
 *
 * La acción del servidor acepta el nombre de la tabla desde el
 * formulario. Lo único que la convierte en segura es que `ENTIDADES` sea
 * una lista blanca estricta: estas pruebas protegen esa lista.
 */

describe('la lista blanca no deja huecos', () => {
  it('ninguna tabla aparece dos veces', () => {
    const tablas = ENTIDADES.map((e) => e.tabla)
    expect(new Set(tablas).size).toBe(tablas.length)
  })

  it('toda entidad declara roles: sin roles nadie podría tocarla, pero tampoco se notaría', () => {
    for (const e of ENTIDADES) {
      expect(e.roles.length, e.tabla).toBeGreaterThan(0)
    }
  })

  it('la columna que da nombre a la fila es editable o es el código', () => {
    // Si el nombre no estuviera entre los campos, se podría crear pero
    // nunca corregir una errata en él.
    for (const e of ENTIDADES) {
      const columnas = e.campos.map((c) => c.columna)
      expect(columnas, `${e.tabla} no permite editar ${e.nombre}`).toContain(e.nombre)
    }
  })

  it('las tablas sensibles no están en la lista', () => {
    // Editar perfiles de acceso desde aquí permitiría cambiarse el rol a
    // uno mismo. Tienen su propia pantalla con sus propias reglas.
    for (const t of ['perfiles', 'usuarios', 'evidencias', 'recomendaciones_ia', 'rubrica']) {
      expect(entidadDe(t), t).toBeUndefined()
    }
  })

  it('ninguna entidad permite editar activo, id ni claves foráneas a mano', () => {
    // `activo` se cambia con alternarEntidad; las FK, con acciones propias
    // (mover curso). Dejarlas como campo libre permitiría recolgar un
    // curso de otro programa sin ninguna comprobación.
    for (const e of ENTIDADES) {
      for (const c of e.campos) {
        expect(c.columna, `${e.tabla}.${c.columna}`).not.toBe('activo')
        expect(c.columna, `${e.tabla}.${c.columna}`).not.toBe('id')
        expect(c.columna.endsWith('_id'), `${e.tabla}.${c.columna}`).toBe(false)
      }
    }
  })

  it('la agregación de un indicador no es editable', () => {
    // Cambiarla con evidencias cargadas reinterpretaría todos los valores.
    const ind = entidadDe('indicadores')!
    expect(ind.campos.map((c) => c.columna)).not.toContain('agregacion')
  })

  it('las entidades con historial son desactivables', () => {
    // Un curso con estudiantes no se puede borrar; sin `activo` no habría
    // forma de retirarlo.
    for (const t of ['universidades', 'programas', 'cursos', 'grupos']) {
      expect(entidadDe(t)!.desactivable, t).toBe(true)
    }
  })

  it('las de la jerarquía declaran alcance, para que un coordinador no toque lo ajeno', () => {
    for (const t of ['programas', 'cursos', 'grupos', 'areas', 'lineas_curriculares', 'unidades']) {
      expect(entidadDe(t)!.alcance, t).toBeDefined()
    }
  })

  it('las que no tienen alcance son sólo del administrador', () => {
    for (const e of ENTIDADES) {
      if (!e.alcance) {
        expect(e.roles, `${e.tabla} sin alcance admite ${e.roles.join(',')}`).toEqual(['admin'])
      }
    }
  })
})

describe('validarCampo protege contra lo que un formulario puede traer', () => {
  const nombre = { columna: 'nombre', etiqueta: 'Nombre', tipo: 'texto' as const, minimo: 3, maximo: 10 }
  const codigo = { columna: 'codigo', etiqueta: 'Código', tipo: 'texto' as const, minimo: 2 }
  const semanas = { columna: 'semanas', etiqueta: 'Semanas', tipo: 'numero' as const, minimo: 1, maximo: 52 }
  const modalidad = { columna: 'modalidad', etiqueta: 'Modalidad', tipo: 'opcion' as const, opciones: ['Virtual', 'Híbrida'] }
  const nota = { columna: 'periodo', etiqueta: 'Periodo', tipo: 'texto' as const, maximo: 30 }

  it('no deja vacío un campo con mínimo', () => {
    expect(validarCampo(nombre, '   ')).toEqual({ error: 'Nombre no puede quedar vacío.' })
  })

  it('un campo opcional vacío se guarda como null, no como cadena vacía', () => {
    expect(validarCampo(nota, '')).toEqual({ valor: null })
  })

  it('recorta espacios y respeta mínimo y máximo de texto', () => {
    expect(validarCampo(nombre, '  ab ')).toEqual({ error: 'Nombre necesita al menos 3 caracteres.' })
    expect(validarCampo(nombre, 'demasiado largo')).toEqual({ error: 'Nombre supera los 10 caracteres.' })
    expect(validarCampo(nombre, '  Lógica ')).toEqual({ valor: 'Lógica' })
  })

  it('los códigos se guardan en mayúsculas, como en las pantallas de alta', () => {
    expect(validarCampo(codigo, 'c04')).toEqual({ valor: 'C04' })
  })

  it('un número fuera de rango o que no es número se rechaza', () => {
    expect(validarCampo(semanas, 'seis')).toEqual({ error: 'Semanas debe ser un número.' })
    expect(validarCampo(semanas, '0')).toEqual({ error: 'Semanas no puede ser menor que 1.' })
    expect(validarCampo(semanas, '99')).toEqual({ error: 'Semanas no puede ser mayor que 52.' })
    expect(validarCampo(semanas, '16')).toEqual({ valor: 16 })
  })

  it('una opción fuera de la lista se rechaza aunque el formulario la envíe', () => {
    expect(validarCampo(modalidad, 'Remota')).toEqual({ error: 'Modalidad: valor no admitido.' })
    expect(validarCampo(modalidad, 'Híbrida')).toEqual({ valor: 'Híbrida' })
  })
})

describe('el mensaje de bloqueo dice exactamente qué impide borrar', () => {
  it('una sola dependencia', () => {
    expect(describirDependientes([{ etiqueta: 'estudiantes', cuantos: 12 }])).toBe('12 estudiantes')
  })

  it('varias, con «y» antes de la última', () => {
    expect(describirDependientes([
      { etiqueta: 'estudiantes', cuantos: 12 },
      { etiqueta: 'grupos', cuantos: 3 },
      { etiqueta: 'actividades', cuantos: 5 },
    ])).toBe('12 estudiantes, 3 grupos y 5 actividades')
  })

  it('ignora las que están a cero', () => {
    expect(describirDependientes([
      { etiqueta: 'estudiantes', cuantos: 0 },
      { etiqueta: 'grupos', cuantos: 2 },
    ])).toBe('2 grupos')
  })

  it('vacío cuando nada depende: entonces sí se puede borrar', () => {
    expect(describirDependientes([{ etiqueta: 'x', cuantos: 0 }])).toBe('')
  })
})

describe('camposParaEditor', () => {
  it('rellena los valores actuales y convierte null en cadena vacía', () => {
    const campos = camposParaEditor('cursos', { codigo: 'C01', nombre: 'Programación', semanas: 6, periodo: null })
    const porColumna = Object.fromEntries(campos.map((c) => [c.columna, c.valor]))
    expect(porColumna).toEqual({ codigo: 'C01', nombre: 'Programación', semanas: '6', periodo: '' })
  })

  it('para una tabla fuera de la lista devuelve vacío, no un editor que el servidor rechazaría', () => {
    expect(camposParaEditor('perfiles', { nombre: 'x' })).toEqual([])
  })
})

const sql = readFileSync(
  join(process.cwd(), 'supabase', 'migraciones', '18_edicion_y_egreso_por_programa.sql'),
  'utf8'
)
const codigoSql = sql.split(/\r?\n/).filter((l) => !l.trimStart().startsWith('--')).join('\n')

describe('la migración 18 destraba lo que el usuario reportó', () => {
  it('la columna obsoleta deja de exigir valor: sin esto no se puede crear una universidad', () => {
    expect(codigoSql).toContain('alter column programa  drop not null')
  })

  it('universidades y cursos pasan a ser desactivables', () => {
    expect(codigoSql).toMatch(/alter table atlas\.universidades\s+add column if not exists activo/)
    expect(codigoSql).toMatch(/alter table atlas\.cursos\s+add column if not exists activo/)
  })

  it('suelta la unique por universidad del perfil de egreso', () => {
    expect(codigoSql).toContain("drop constraint perfiles_egreso_universidad_id_key")
  })

  it('no asigna un programa al azar cuando la universidad tiene varios', () => {
    // Elegir uno cualquiera pondría el perfil en el programa equivocado
    // sin que nadie lo notara.
    expect(codigoSql).toContain('= 1')
    expect(codigoSql).toContain('pe.programa_id is null')
  })

  it('es segura de reejecutar', () => {
    expect(codigoSql).toContain("if exists (")
    expect(codigoSql).toContain("add column if not exists")
  })
})
