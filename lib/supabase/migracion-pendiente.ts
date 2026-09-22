/**
 * ¿El error viene de que falta aplicar una migración?
 *
 * Las migraciones se aplican a mano desde el SQL Editor, así que la
 * aplicación tiene que funcionar antes de que existan sus tablas y
 * funciones: muestra un aviso accionable en vez de una pantalla rota.
 *
 * Los códigos, que no son intercambiables:
 *
 *   PGRST205  PostgREST no encuentra la TABLA en su caché de esquema
 *   PGRST202  PostgREST no encuentra la FUNCIÓN (RPC)
 *   42P01     Postgres: la tabla no existe
 *   42883     Postgres: la función no existe
 *   42703     Postgres: la columna no existe
 *
 * Olvidar PGRST202 costó un error 500 en la pantalla de analítica: la
 * comprobación cubría tablas pero no funciones, y las tres RPC nuevas
 * reventaban en vez de devolver vacío. De ahí que esto viva en un solo
 * sitio y no repetido en cada módulo.
 */
const CODIGOS_MIGRACION_PENDIENTE = new Set([
  'PGRST205', 'PGRST202', '42P01', '42883', '42703',
])

export function faltaMigracion(codigo?: string | null): boolean {
  return codigo != null && CODIGOS_MIGRACION_PENDIENTE.has(codigo)
}
