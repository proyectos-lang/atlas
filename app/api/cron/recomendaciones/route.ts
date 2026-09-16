import { NextResponse, type NextRequest } from 'next/server'
import { generarRecomendaciones } from '@/lib/ia/agente'
import type { Alcance } from '@/lib/auth/alcance'

/**
 * Generación programada. Protegido por token: se invoca desde un cron
 * de Vercel con la cabecera Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(peticion: NextRequest) {
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 })
  }

  const cabecera = peticion.headers.get('authorization')
  if (cabecera !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // El cron corre sin sesión: alcance completo, explícito y trazable.
  const alcance: Alcance = {
    rol: 'admin', universidadIds: null, programaIds: null,
    cursoIds: null, grupoIds: null, usuarioIds: null, perfilId: 0,
  }

  try {
    const r = await generarRecomendaciones(alcance)
    return NextResponse.json({ ...r, modelo: 'claude-opus-5' })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    )
  }
}
