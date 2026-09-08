import type { Alcance, Perfil } from '@/lib/auth/alcance'
import type { Conteos, Curso, Estudiante } from '@/lib/kpi/consultas'

/**
 * Vista provisional de la etapa 3: muestra qué ve realmente cada perfil.
 * Se reemplaza en la etapa 6 por la fila de nueve tarjetas y los visuales.
 */
export function ResumenAlcance({
  perfil,
  alcance,
  conteos,
  cursos,
  estudiantes,
}: {
  perfil: Perfil
  alcance: Alcance
  conteos: Conteos
  cursos: Curso[]
  estudiantes: Estudiante[]
}) {
  const ambito = (v: number[] | null) =>
    v === null ? 'sin restricción' : v.length === 0 ? 'ninguno' : v.join(', ')

  return (
    <div className="space-y-6">
      <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
        <h2 className="text-lg font-semibold text-institucional">
          Alcance de este perfil
        </h2>
        <p className="mt-1 text-sm text-texto-secundario">
          Rol <strong>{perfil.rol}</strong>. Todo dato de esta página está
          filtrado en el servidor por este alcance.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-texto-secundario">Universidades</dt>
            <dd className="font-medium">{ambito(alcance.universidadIds)}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Cursos</dt>
            <dd className="font-medium">{ambito(alcance.cursoIds)}</dd>
          </div>
          <div>
            <dt className="text-texto-secundario">Estudiantes</dt>
            <dd className="font-medium">{ambito(alcance.usuarioIds)}</dd>
          </div>
        </dl>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta titulo="Cursos" valor={conteos.cursos}
          pie={`en ${conteos.universidades} universidades`} />
        <Tarjeta titulo="Docentes" valor={conteos.docentes}
          pie={conteos.docentes === 0 ? 'sin registros de docente' : 'registrados'} />
        <Tarjeta titulo="Estudiantes" valor={conteos.estudiantes} pie="matriculados" />
        <Tarjeta titulo="Actividades" valor={conteos.actividades} pie="evaluables" />
        <Tarjeta titulo="Resultados de aprendizaje" valor={conteos.ilos}
          pie="ILOs definidos" />
        <Tarjeta titulo="Recomendaciones generadas"
          valor={conteos.recomendacionesGeneradas} pie="por el asistente" />
        {/*
          Sin ninguna implementada todavía no hay porcentaje que mostrar:
          se usa guion largo y leyenda, nunca 0 %.
        */}
        <Tarjeta
          titulo="Recomendaciones implementadas"
          valor={conteos.recomendacionesImplementadas}
          sinDato={conteos.recomendacionesImplementadas === 0}
          pie={
            conteos.recomendacionesImplementadas === 0
              ? 'sin resultados aún'
              : `${Math.round(
                  (100 * conteos.recomendacionesImplementadas) /
                    conteos.recomendacionesGeneradas
                )}% del total`
          }
        />
      </section>

      <section className="rounded-tarjeta border border-superficie-borde bg-white p-5">
        <h2 className="text-lg font-semibold text-institucional">
          Cursos visibles ({cursos.length})
        </h2>
        <ul className="mt-3 space-y-1 text-sm">
          {cursos.length === 0 && (
            <li className="text-texto-secundario">Ninguno en tu alcance.</li>
          )}
          {cursos.map((c) => (
            <li key={c.id}>
              <span className="font-medium">{c.nombre}</span>{' '}
              <span className="text-texto-secundario">({c.codigo})</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-texto-secundario">
          Estudiantes visibles: <strong>{estudiantes.length}</strong>
          {estudiantes.length > 0 && (
            <> — de {estudiantes[0].codigo} a {estudiantes[estudiantes.length - 1].codigo}</>
          )}
        </p>
      </section>
    </div>
  )
}

function Tarjeta({
  titulo, valor, pie, sinDato = false,
}: { titulo: string; valor: number; pie: string; sinDato?: boolean }) {
  return (
    <div className="rounded-tarjeta border border-superficie-borde border-t-[3px] border-t-institucional bg-white p-4">
      <p className="text-sm text-texto-secundario">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold text-institucional">
        {sinDato ? '—' : valor}
      </p>
      <p className="mt-1 text-xs text-texto-secundario">{pie}</p>
    </div>
  )
}
