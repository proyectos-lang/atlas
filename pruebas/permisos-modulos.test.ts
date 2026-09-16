import { describe, expect, it } from 'vitest'
import {
  RUTAS_POR_ROL, INICIO_POR_ROL, modulosDe, perfilPuedeVer, inicioDe,
  puedeVer, type Perfil, type Rol,
} from '@/lib/auth/alcance'
import { navegacionDe } from '@/lib/auth/navegacion'

const ROLES: Rol[] = ['admin', 'coordinador', 'asesor', 'docente', 'estudiante']

const perfil = (rol: Rol, modulos: string[] | null = null): Perfil => ({
  id: 1, authUserId: 'u', nombre: 'X', email: 'x@y.z', activo: true,
  rol, universidadId: null, programaId: null, cursoId: null, grupoId: null,
  usuarioId: null, modulos,
})

describe('null y array vacío no son lo mismo', () => {
  it('null usa los módulos del rol', () => {
    for (const rol of ROLES) {
      expect(modulosDe(perfil(rol, null)), rol).toEqual(RUTAS_POR_ROL[rol])
    }
  })

  it('el array vacío deja al perfil sin ningún módulo', () => {
    for (const rol of ROLES) {
      expect(modulosDe(perfil(rol, [])), rol).toEqual([])
      expect(perfilPuedeVer(perfil(rol, []), INICIO_POR_ROL[rol]), rol).toBe(false)
    }
  })

  it('un perfil sin personalizar se comporta igual que antes de esta función', () => {
    // Es lo que protege a los perfiles creados antes de la migración 07.
    for (const rol of ROLES) {
      for (const ruta of RUTAS_POR_ROL[rol]) {
        expect(perfilPuedeVer(perfil(rol, null), ruta), `${rol} ${ruta}`).toBe(
          puedeVer(rol, ruta)
        )
      }
    }
  })
})

describe('los módulos concedidos mandan sobre el rol', () => {
  it('se puede conceder un módulo que el rol no traía', () => {
    const p = perfil('estudiante', ['/inicio', '/analisis'])
    expect(puedeVer('estudiante', '/analisis')).toBe(false)
    expect(perfilPuedeVer(p, '/analisis')).toBe(true)
  })

  it('se puede retirar un módulo que el rol sí traía', () => {
    const p = perfil('admin', ['/inicio'])
    expect(puedeVer('admin', '/administrador')).toBe(true)
    expect(perfilPuedeVer(p, '/administrador')).toBe(false)
  })

  it('conceder una ruta concede sus subrutas', () => {
    const p = perfil('docente', ['/admin'])
    expect(perfilPuedeVer(p, '/admin/perfiles')).toBe(true)
    expect(perfilPuedeVer(p, '/admin/perfil-egreso')).toBe(true)
  })

  it('una subruta NO concede la ruta padre ni sus hermanas', () => {
    const p = perfil('docente', ['/admin/perfil-egreso'])
    expect(perfilPuedeVer(p, '/admin/perfil-egreso')).toBe(true)
    expect(perfilPuedeVer(p, '/admin/perfiles')).toBe(false)
    expect(perfilPuedeVer(p, '/admin')).toBe(false)
  })

  it('no se cuela una ruta por parecido de prefijo', () => {
    // '/admin' no debe habilitar '/administrador': son rutas distintas.
    const p = perfil('docente', ['/admin'])
    expect(perfilPuedeVer(p, '/administrador')).toBe(false)
  })
})

describe('el destino tras un acceso denegado siempre es alcanzable', () => {
  it('nunca devuelve una ruta que el perfil no pueda ver', () => {
    const casos: [Rol, string[] | null][] = [
      ['admin', null], ['docente', null], ['estudiante', null],
      ['docente', ['/analisis']],
      ['admin', ['/administrador']],
      ['estudiante', ['/acerca-de']],
    ]
    for (const [rol, modulos] of casos) {
      const p = perfil(rol, modulos)
      const destino = inicioDe(p)
      expect(destino, `${rol} ${JSON.stringify(modulos)}`).not.toBeNull()
      expect(perfilPuedeVer(p, destino!), `${rol} -> ${destino}`).toBe(true)
    }
  })

  it('sin módulos no hay destino: se va a /sin-acceso, no a un bucle', () => {
    for (const rol of ROLES) {
      expect(inicioDe(perfil(rol, [])), rol).toBeNull()
    }
  })

  it('prefiere /inicio cuando está concedido', () => {
    expect(inicioDe(perfil('docente', ['/inicio', '/analisis']))).toBe('/inicio')
  })

  it('si /inicio no está, cae en el tablero del rol', () => {
    expect(inicioDe(perfil('docente', ['/docente']))).toBe('/docente')
  })

  it('si tampoco está el tablero del rol, usa el primer módulo concedido', () => {
    expect(inicioDe(perfil('docente', ['/analisis']))).toBe('/analisis')
  })
})

describe('la navegación refleja los módulos, no el rol', () => {
  it('sólo muestra lo concedido', () => {
    const p = perfil('admin', ['/inicio', '/analisis'])
    const rutas = navegacionDe(p).flatMap((g) => g.items.map((i) => i.ruta))
    expect(rutas.sort()).toEqual(['/analisis', '/inicio'])
  })

  it('un perfil sin módulos no tiene navegación', () => {
    expect(navegacionDe(perfil('admin', []))).toEqual([])
  })

  it('sin personalizar coincide con la navegación del rol', () => {
    for (const rol of ROLES) {
      const porPerfil = navegacionDe(perfil(rol, null))
      const porRol = navegacionDe(rol)
      expect(porPerfil, rol).toEqual(porRol)
    }
  })

  it('todo lo que aparece en el menú es visitable', () => {
    // Un ítem visible que luego redirige sería una trampa para el usuario.
    const p = perfil('estudiante', ['/inicio', '/analisis', '/acerca-de'])
    for (const g of navegacionDe(p)) {
      for (const i of g.items) {
        expect(perfilPuedeVer(p, i.ruta), i.ruta).toBe(true)
      }
    }
  })
})

describe('el alcance de datos no se toca', () => {
  it('conceder un módulo no cambia ninguna dimensión del alcance', () => {
    // `modulos` decide qué PANTALLAS se ven; el Alcance, qué FILAS se leen.
    // Este test falla si alguien intenta derivar alcance de los módulos.
    const sinModulos = perfil('docente', null)
    const conTodo = perfil('docente', [...RUTAS_POR_ROL.admin])

    expect(conTodo.universidadId).toBe(sinModulos.universidadId)
    expect(conTodo.cursoId).toBe(sinModulos.cursoId)
    expect(conTodo.usuarioId).toBe(sinModulos.usuarioId)
    expect(conTodo.rol).toBe('docente')
  })
})
