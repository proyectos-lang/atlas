import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tamanoLegible, TAMANO_MAXIMO, BUCKET } from '@/lib/documentos/almacen'

/**
 * Subida del plan de estudios en PDF.
 *
 * `validarPdf` no se prueba aquí porque necesita un `File` del navegador y
 * depende de `server-only`. Su comportamiento se verificó contra el
 * Storage real: un archivo de texto renombrado a .pdf se rechaza por la
 * firma, el acceso público al bucket devuelve 400 y sólo la URL firmada
 * sirve el archivo.
 */

describe('el tamaño se muestra en unidades legibles', () => {
  it('bytes cuando es diminuto', () => {
    expect(tamanoLegible(512)).toBe('512 B')
  })

  it('kilobytes cuando corresponde', () => {
    expect(tamanoLegible(2048)).toBe('2 KB')
    expect(tamanoLegible(900 * 1024)).toBe('900 KB')
  })

  it('megabytes con coma decimal, como el resto de la aplicación', () => {
    expect(tamanoLegible(2.5 * 1024 * 1024)).toBe('2,5 MB')
    expect(tamanoLegible(20 * 1024 * 1024)).toBe('20,0 MB')
  })

  it('un archivo vacío no rompe el formato', () => {
    expect(tamanoLegible(0)).toBe('0 B')
  })
})

describe('los límites coinciden con lo configurado en el bucket', () => {
  it('el máximo son 20 MB', () => {
    // El mismo número está en el bucket de Supabase. Si aquí fuera mayor,
    // el usuario vería un error técnico del Storage en vez del mensaje
    // explicado.
    expect(TAMANO_MAXIMO).toBe(20 * 1024 * 1024)
  })

  it('el bucket es el propio de ATLAS, no uno compartido', () => {
    // El proyecto de Supabase aloja otro sistema con sus buckets
    // (`archivos`, `hojas`). Mezclar los documentos sería un problema de
    // mantenimiento y de privacidad.
    expect(BUCKET).toBe('atlas-documentos')
  })
})

const sql = readFileSync(
  join(process.cwd(), 'supabase', 'migraciones', '17_plan_estudios_pdf.sql'),
  'utf8'
)

const soloCodigo = sql
  .split(/\r?\n/)
  .filter((l) => !l.trimStart().startsWith('--'))
  .join('\n')

describe('la migración guarda la referencia, no el archivo', () => {
  it('añade las cinco columnas del documento', () => {
    for (const c of [
      'plan_estudios_archivo', 'plan_estudios_nombre',
      'plan_estudios_tamano', 'plan_estudios_subido_en',
      'plan_estudios_subido_por',
    ]) {
      expect(soloCodigo, c).toContain(c)
    }
  })

  it('no guarda los bytes en la tabla', () => {
    // Un PDF de varios MB dentro de la fila inflaría cada copia de
    // seguridad y cada consulta que la lea.
    expect(soloCodigo).not.toContain('bytea')
    expect(soloCodigo).not.toContain('base64')
  })

  it('conserva el campo de texto: el PDF no lo reemplaza', () => {
    // El agente de IA puede leer el texto como contexto; un PDF no.
    expect(soloCodigo).not.toContain('drop column')
    expect(soloCodigo.includes('plan_estudios text')).toBe(false)
  })

  it('exige nombre si hay archivo', () => {
    // Una referencia sin nombre sale en pantalla como un enlace sin
    // etiqueta.
    expect(soloCodigo).toContain('ck_plan_estudios_archivo')
  })

  it('es segura de reejecutar', () => {
    const añade = (soloCodigo.match(/add column/g) ?? []).length
    const guardas = (soloCodigo.match(/add column if not exists/g) ?? []).length
    expect(añade).toBeGreaterThan(0)
    expect(guardas).toBe(añade)
  })
})
