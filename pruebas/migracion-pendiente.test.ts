import { describe, expect, it } from 'vitest'
import { faltaMigracion } from '@/lib/supabase/migracion-pendiente'

/**
 * Las migraciones se aplican a mano, así que la aplicación tiene que
 * funcionar antes de que existan sus tablas y funciones.
 *
 * Esta comprobación estaba repetida en nueve sitios y a uno le faltaba
 * PGRST202 --el código de «función no encontrada»--, lo que tumbó la
 * pantalla de analítica con un error 500 en vez de mostrar el aviso. De
 * ahí que ahora viva en un solo lugar y tenga prueba propia.
 */

describe('reconoce que falta una tabla', () => {
  it('PGRST205: PostgREST no la tiene en su caché de esquema', () => {
    expect(faltaMigracion('PGRST205')).toBe(true)
  })

  it('42P01: Postgres dice que no existe', () => {
    expect(faltaMigracion('42P01')).toBe(true)
  })
})

describe('reconoce que falta una función', () => {
  it('PGRST202: el caso que causó el error 500', () => {
    // Las RPC de analítica devuelven este código, no PGRST205.
    expect(faltaMigracion('PGRST202')).toBe(true)
  })

  it('42883: Postgres dice que la función no existe', () => {
    expect(faltaMigracion('42883')).toBe(true)
  })
})

describe('reconoce que falta una columna', () => {
  it('42703', () => {
    expect(faltaMigracion('42703')).toBe(true)
  })
})

describe('no confunde otros errores con una migración pendiente', () => {
  it('una violación de unicidad es un error real del usuario', () => {
    // Tragarse esto devolvería lista vacía y el usuario no sabría que su
    // dato estaba duplicado.
    expect(faltaMigracion('23505')).toBe(false)
  })

  it('una violación de check tampoco', () => {
    expect(faltaMigracion('23514')).toBe(false)
  })

  it('una violación de clave foránea tampoco', () => {
    expect(faltaMigracion('23503')).toBe(false)
  })

  it('sin código no se asume nada', () => {
    expect(faltaMigracion(undefined)).toBe(false)
    expect(faltaMigracion(null)).toBe(false)
    expect(faltaMigracion('')).toBe(false)
  })
})
