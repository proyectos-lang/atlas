import { exigirRol } from '@/lib/auth/sesion'
import { Marco } from '@/componentes/marco'
import { SubNavAdmin } from '@/componentes/sub-nav-admin'
import { clienteServidor } from '@/lib/supabase/servidor'
import { universidades, programas, cursos } from '@/lib/kpi/consultas'
import { competencias as competenciasDe } from '@/lib/curriculo/modelo'
import { Asistente } from './asistente'

export const metadata = { title: 'Asistente de creación · ATLAS' }

/**
 * Asistente de creación guiado.
 *
 * Reportado por el usuario final: intentaba crear universidades y
 * programas y «tenía errores». No había errores: no había pantalla para
 * crear universidades ni cursos, y la de programas estaba enterrada en la
 * jerarquía. Aquí se pregunta primero qué se quiere crear y se guía paso
 * a paso hasta el final, proponiendo lo que naturalmente sigue.
 */
export default async function PaginaCrear() {
  const { perfil, alcance } = await exigirRol(['admin', 'coordinador'], '/admin/crear')

  const [listaUniv, listaProg, listaCursos, listaComp] = await Promise.all([
    universidades(alcance),
    programas(alcance),
    cursos(alcance),
    competenciasDe(alcance),
  ])

  const db = clienteServidor()
  const { data: perfilesDocentes } = await db
    .from('perfiles')
    .select('id, nombre, rol')
    .in('rol', ['docente', 'coordinador'])
    .eq('activo', true)
    .order('nombre')

  return (
    <Marco perfil={perfil} titulo="Asistente de creación" lateral={<SubNavAdmin />}>
      <div className="space-y-5">
        <Asistente
          universidades={listaUniv.map((u) => ({ id: u.id, etiqueta: u.universidad }))}
          programas={listaProg.map((p) => ({
            id: p.id, etiqueta: p.nombre, universidadId: p.universidadId,
          }))}
          cursos={listaCursos.map((c) => ({
            id: c.id, etiqueta: `${c.nombre} (${c.codigo})`, programaId: c.programaId,
          }))}
          competencias={listaComp.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
          docentes={(perfilesDocentes ?? []).map((d) => ({
            id: Number(d.id), etiqueta: String(d.nombre),
          }))}
          puedeCrearUniversidad={perfil.rol === 'admin'}
        />

        <p className="px-1 text-xs text-texto-secundario">
          Para editar o eliminar lo ya creado, ve a <strong>Jerarquía
          académica</strong> o a la pantalla correspondiente: cada elemento
          tiene su propio «Editar».
        </p>
      </div>
    </Marco>
  )
}
