import { describe, it, expect } from 'vitest'
import { RUTAS_POR_ROL, INICIO_POR_ROL, puedeVer, type Rol } from '@/lib/auth/alcance'
import { navegacionDe, rutasHuerfanas } from '@/lib/auth/navegacion'

const ROLES: Rol[] = ['admin', 'coordinador', 'asesor', 'docente', 'estudiante']

describe('la navegación agrupada no concede ni oculta accesos', () => {
  it('ningún rol ve en el menú una ruta que no tenga permitida', () => {
    for (const rol of ROLES) {
      for (const grupo of navegacionDe(rol)) {
        for (const item of grupo.items) {
          expect(puedeVer(rol, item.ruta), `${rol} no debería ver ${item.ruta}`).toBe(true)
        }
      }
    }
  })

  it('ninguna ruta permitida se queda fuera del menú', () => {
    // Si alguien añade una ruta a RUTAS_POR_ROL y olvida agruparla, la ruta
    // existe pero es inalcanzable desde la interfaz. Esto lo detecta.
    for (const rol of ROLES) {
      expect(rutasHuerfanas(rol), `${rol} tiene rutas sin agrupar`).toEqual([])
    }
  })

  it('no hay grupos vacíos', () => {
    for (const rol of ROLES) {
      for (const grupo of navegacionDe(rol)) {
        expect(grupo.items.length, `${rol}: grupo "${grupo.titulo}" vacío`).toBeGreaterThan(0)
      }
    }
  })

  it('no se repite una ruta en dos grupos', () => {
    for (const rol of ROLES) {
      const rutas = navegacionDe(rol).flatMap((g) => g.items.map((i) => i.ruta))
      expect(new Set(rutas).size, `${rol} repite rutas`).toBe(rutas.length)
    }
  })
})

describe('el panel de inicio es alcanzable', () => {
  it('todos los roles pueden ver /inicio', () => {
    for (const rol of ROLES) {
      expect(puedeVer(rol, '/inicio'), `${rol}`).toBe(true)
    }
  })

  it('cada rol conserva su tablero principal', () => {
    for (const rol of ROLES) {
      expect(puedeVer(rol, INICIO_POR_ROL[rol]), `${rol}`).toBe(true)
    }
  })

  it('el estudiante sigue sin ver tableros ajenos', () => {
    // El agrupado no debe haber ampliado el alcance de nadie.
    expect(puedeVer('estudiante', '/administrador')).toBe(false)
    expect(puedeVer('estudiante', '/admin')).toBe(false)
    expect(puedeVer('docente', '/administrador')).toBe(false)
    expect(puedeVer('asesor', '/admin')).toBe(false)
  })

  it('la configuración se reparte según quién conoce cada nivel', () => {
    // El coordinador configura el currículo de su programa; el docente, la
    // ficha de su asignatura y sus fuentes. Conceder la PANTALLA no amplía
    // los DATOS: eso lo sigue limitando el Alcance.
    expect(puedeVer('coordinador', '/admin/curriculo')).toBe(true)
    expect(puedeVer('docente', '/admin/curriculo')).toBe(true)
    expect(puedeVer('docente', '/admin/fuentes')).toBe(true)

    // Los perfiles de acceso siguen siendo sólo del administrador: quien
    // puede crear cuentas puede concederse cualquier cosa.
    for (const rol of ROLES) {
      expect(puedeVer(rol, '/admin/perfiles'), `${rol} en perfiles`).toBe(rol === 'admin')
    }

    // El estudiante no configura nada.
    expect(puedeVer('estudiante', '/admin/curriculo')).toBe(false)
    expect(puedeVer('estudiante', '/admin/fuentes')).toBe(false)
  })
})

describe('cada rol tiene navegación utilizable', () => {
  it('ningún rol se queda sin ítems', () => {
    for (const rol of ROLES) {
      const total = navegacionDe(rol).reduce((t, g) => t + g.items.length, 0)
      expect(total, `${rol} no tiene navegación`).toBeGreaterThan(0)
    }
  })

  it('cada ruta permitida aparece en el menú, salvo las de paso', () => {
    // `/admin` sólo redirige a sus subsecciones, que sí tienen ítem
    // propio; no es un destino con contenido.
    const PUENTE = ['/admin']

    for (const rol of ROLES) {
      const enMenu = navegacionDe(rol).flatMap((g) => g.items.map((i) => i.ruta))
      const esperadas = RUTAS_POR_ROL[rol].filter((r) => !PUENTE.includes(r))

      for (const r of esperadas) {
        expect(enMenu, `${rol}: ${r} no está en el menú`).toContain(r)
      }
    }
  })
})
