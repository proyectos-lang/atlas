import { redirect } from 'next/navigation'
import { perfilActual } from '@/lib/auth/sesion'
import { INICIO_POR_ROL } from '@/lib/auth/alcance'

/** La raíz lleva a cada quien a su página inicial. */
export default async function Inicio() {
  const perfil = await perfilActual()
  redirect(perfil ? INICIO_POR_ROL[perfil.rol] : '/entrar')
}
