'use client'

import { useActionState, useState } from 'react'
import { BotonEnvio } from '@/componentes/ui/boton-envio'
import { crearMapeo, cargarEvidencias, type EstadoFuente } from './acciones'

export interface Opcion {
  id: number
  etiqueta: string
  pie?: string
}

const CAMPO =
  'mt-1.5 w-full rounded-lg border border-superficie-borde px-3 py-2 text-sm ' +
  'outline-none transition focus:border-institucional focus:ring-2 ' +
  'focus:ring-institucional/20'

const AYUDA_TRANSFORMACION: Record<string, string> = {
  Directo: 'El valor se usa tal cual. Para datos que ya vienen en la escala del indicador.',
  Escalar: 'El valor se multiplica por un factor.',
  Normalizar: 'Se convierte a porcentaje sobre un máximo: 100 × valor ÷ máximo.',
  Booleano: 'Sí o 1 valen 100; no o 0 valen 0. Para cumplió / no cumplió.',
}

function Mensajes({ estado }: { estado: EstadoFuente }) {
  return (
    <>
      {estado.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {estado.ok}
        </p>
      )}
      {estado.resumen && estado.resumen.errores.length > 0 && (
        <ul className="mt-1 space-y-0.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {estado.resumen.errores.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {estado.resumen.rechazadas > estado.resumen.errores.length && (
            <li className="font-medium">
              …y {estado.resumen.rechazadas - estado.resumen.errores.length} más.
            </li>
          )}
        </ul>
      )}
    </>
  )
}

export function FormularioMapeo({
  fuentes,
  indicadores,
  cursos,
}: {
  fuentes: Opcion[]
  indicadores: Opcion[]
  cursos: Opcion[]
}) {
  const [estado, accion] = useActionState<EstadoFuente, FormData>(crearMapeo, {})
  const [transformacion, setTransformacion] = useState('Directo')

  if (fuentes.length === 0 || indicadores.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">
        Hacen falta fuentes e indicadores configurados.
      </p>
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Fuente</label>
          <select name="fuente_id" className={CAMPO}>
            {fuentes.map((f) => (
              <option key={f.id} value={f.id}>{f.etiqueta}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Variable</label>
          <input name="variable" required placeholder="contribuciones" className={CAMPO} />
          <p className="mt-1 text-xs text-texto-secundario">
            El nombre del dato en la fuente, tal como viene.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Alimenta el indicador</label>
        <select name="indicador_id" className={CAMPO}>
          {indicadores.map((i) => (
            <option key={i.id} value={i.id}>
              {i.etiqueta}{i.pie ? ` — ${i.pie}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Transformación</label>
        <select
          name="transformacion"
          value={transformacion}
          onChange={(e) => setTransformacion(e.target.value)}
          className={CAMPO}
        >
          {Object.keys(AYUDA_TRANSFORMACION).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <p className="mt-1 text-xs text-texto-secundario">
          {AYUDA_TRANSFORMACION[transformacion]}
        </p>
      </div>

      {transformacion === 'Escalar' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Factor <span className="text-red-600">*</span>
          </label>
          <input name="factor" type="number" step="any" required className={CAMPO} />
        </div>
      )}

      {transformacion === 'Normalizar' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Valor máximo <span className="text-red-600">*</span>
          </label>
          <input name="valor_maximo" type="number" step="any" required className={CAMPO} />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Curso <span className="font-normal text-texto-secundario">(opcional)</span>
        </label>
        <select name="curso_id" className={CAMPO} defaultValue="">
          <option value="">Todos los cursos</option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>{c.etiqueta}</option>
          ))}
        </select>
      </div>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Creando…">Crear mapeo</BotonEnvio>
    </form>
  )
}

export function FormularioCarga({
  fuentes,
  indicadores,
  cursos,
}: {
  fuentes: Opcion[]
  indicadores: Opcion[]
  cursos: Opcion[]
}) {
  const [estado, accion] = useActionState<EstadoFuente, FormData>(cargarEvidencias, {})
  const [transformacion, setTransformacion] = useState('Directo')

  if (cursos.length === 0 || indicadores.length === 0) {
    return (
      <p className="text-sm text-texto-secundario">
        Hacen falta cursos e indicadores configurados.
      </p>
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Fuente</label>
          <select name="fuente_id" className={CAMPO}>
            {fuentes.map((f) => (
              <option key={f.id} value={f.id}>{f.etiqueta}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Curso</label>
          <select name="curso_id" className={CAMPO}>
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>{c.etiqueta}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Indicador</label>
        <select name="indicador_id" className={CAMPO}>
          {indicadores.map((i) => (
            <option key={i.id} value={i.id}>
              {i.etiqueta}{i.pie ? ` — ${i.pie}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Datos</label>
        <p className="mt-0.5 text-xs text-texto-secundario">
          Pega el contenido con una cabecera. Columnas: <code>estudiante</code>{' '}
          y <code>valor</code> obligatorias; <code>semana</code> y{' '}
          <code>maximo</code> opcionales.
        </p>
        <textarea
          name="csv"
          required
          rows={8}
          placeholder={'estudiante,valor,semana\nE001,4,3\nE002,7,3'}
          className={`${CAMPO} font-mono text-xs`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Separador</label>
          <select name="separador" className={CAMPO} defaultValue=",">
            <option value=",">Coma</option>
            <option value=";">Punto y coma</option>
            <option value="&#9;">Tabulación</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Transformación</label>
          <select
            name="transformacion"
            value={transformacion}
            onChange={(e) => setTransformacion(e.target.value)}
            className={CAMPO}
          >
            {Object.keys(AYUDA_TRANSFORMACION).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {transformacion === 'Escalar' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Factor</label>
          <input name="factor" type="number" step="any" required className={CAMPO} />
        </div>
      )}

      {transformacion === 'Normalizar' && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Valor máximo por defecto
          </label>
          <input name="valor_maximo" type="number" step="any" className={CAMPO} />
          <p className="mt-1 text-xs text-texto-secundario">
            Se usa cuando la fila no trae su propia columna <code>maximo</code>.
          </p>
        </div>
      )}

      <p className="rounded-md border-l-2 border-institucional/30 bg-institucional-suave px-3 py-2 text-xs text-slate-700">
        La carga es <strong>todo o nada</strong>: si alguna fila tiene
        problemas no se guarda ninguna, y se listan los errores para que
        puedas corregirlos.
      </p>

      <Mensajes estado={estado} />
      <BotonEnvio enProgreso="Cargando…">Cargar evidencias</BotonEnvio>
    </form>
  )
}
