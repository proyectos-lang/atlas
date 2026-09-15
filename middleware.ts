import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Refresca la sesión de Supabase en cada petición y bloquea el acceso a
 * rutas protegidas sin sesión.
 *
 * La comprobación de rol NO se hace aquí: el middleware corre en el runtime
 * Edge y no puede leer el esquema `atlas` con la service role key. El rol
 * se verifica en cada página con exigirSesion(ruta) / exigirRol(), que sí
 * corren en el servidor. Este middleware sólo evita que un usuario sin
 * sesión llegue a renderizar.
 */

// /api/cron no lleva sesión: lo invoca un cron con token propio y se
// autoriza dentro del handler. Sin esta excepción el middleware lo
// redirigía al login y el cron nunca llegaría a ejecutarse.
const PUBLICAS = ['/entrar', '/auth', '/api/cron']

// La raíz es la landing pública y se compara EXACTA, nunca como prefijo:
// '/' como prefijo abriría la aplicación entera.
const RAIZ_PUBLICA = '/'

export async function middleware(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (galletas) => {
          for (const { name, value } of galletas) {
            peticion.cookies.set(name, value)
          }
          respuesta = NextResponse.next({ request: peticion })
          for (const { name, value, options } of galletas) {
            respuesta.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const ruta = peticion.nextUrl.pathname
  const esPublica =
    ruta === RAIZ_PUBLICA ||
    PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))

  if (!user && !esPublica) {
    const destino = peticion.nextUrl.clone()
    destino.pathname = '/entrar'
    destino.searchParams.set('siguiente', ruta)
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  matcher: [
    /*
     * Todas las rutas menos estáticos, imágenes y favicon.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
