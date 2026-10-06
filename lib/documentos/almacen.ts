import 'server-only'
import { clienteServidor } from '@/lib/supabase/servidor'

/**
 * Almacenamiento de documentos de ATLAS.
 *
 * El bucket es PRIVADO: los archivos se sirven con URL firmada temporal,
 * nunca con enlace permanente. Un plan de estudios no es secreto, pero un
 * enlace que funciona para siempre y para cualquiera no es algo que se
 * deba conceder sin pensarlo.
 */

export const BUCKET = 'atlas-documentos'

/** 20 MB. El mismo límite está configurado en el bucket. */
export const TAMANO_MAXIMO = 20 * 1024 * 1024

/** Validez de la URL firmada, en segundos. Una hora basta para leer o descargar. */
const VALIDEZ_FIRMA = 3600

export interface ArchivoSubido {
  ruta: string
  nombre: string
  tamano: number
}

export interface ErrorSubida {
  error: string
}

/**
 * Comprueba que el archivo es un PDF aceptable.
 *
 * El bucket ya restringe tipo y tamaño, pero rechazar aquí da un mensaje
 * que el usuario entiende en vez del error técnico del Storage. Y la
 * comprobación de los primeros bytes es la única que no se puede falsear
 * renombrando la extensión.
 */
export async function validarPdf(archivo: File): Promise<string | null> {
  if (archivo.size === 0) return 'El archivo está vacío.'

  if (archivo.size > TAMANO_MAXIMO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1).replace('.', ',')
    return `El archivo pesa ${mb} MB y el máximo son 20 MB.`
  }

  // La extensión y el tipo declarado los pone el navegador y se pueden
  // manipular. La firma `%PDF-` del inicio del archivo, no.
  const cabecera = new Uint8Array(await archivo.slice(0, 5).arrayBuffer())
  const firma = String.fromCharCode(...cabecera)

  if (firma !== '%PDF-') {
    return 'El archivo no es un PDF válido. Comprueba que no se haya renombrado otro tipo de archivo.'
  }

  return null
}

/**
 * Nombre seguro para guardar.
 *
 * Se conserva el original para mostrarlo, pero la ruta usa un nombre
 * saneado: un nombre con `../` o con caracteres de ruta podría escribir
 * fuera de la carpeta prevista.
 */
function rutaSegura(programaId: number, nombreOriginal: string): string {
  const base = nombreOriginal
    .replace(/\.pdf$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // quita acentos
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  const sello = Date.now()
  return `planes-estudio/${programaId}/${sello}-${base || 'plan'}.pdf`
}

/**
 * Sube el plan de estudios de un programa.
 *
 * No borra el anterior: si la subida nueva falla a medias, el anterior
 * sigue ahí. El viejo se elimina después, sólo cuando la base ya apunta
 * al nuevo.
 */
export async function subirPlanEstudios(
  programaId: number,
  archivo: File
): Promise<ArchivoSubido | ErrorSubida> {
  const problema = await validarPdf(archivo)
  if (problema) return { error: problema }

  const ruta = rutaSegura(programaId, archivo.name)
  const db = clienteServidor()

  const { error } = await db.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: 'application/pdf',
    upsert: false,
  })

  if (error) {
    // El bucket puede no existir todavía: es más útil decirlo que
    // devolver «Bucket not found».
    if (/not found/i.test(error.message)) {
      return {
        error:
          `Falta el bucket ${BUCKET} en Supabase Storage. ` +
          'Créalo como privado, con límite de 20 MB y tipo application/pdf.',
      }
    }
    return { error: `No se pudo subir el archivo: ${error.message}` }
  }

  return { ruta, nombre: archivo.name, tamano: archivo.size }
}

/**
 * URL temporal para leer un archivo privado.
 *
 * Devuelve `null` en vez de lanzar: un enlace que no se puede firmar es
 * un enlace que no se muestra, no una pantalla rota.
 */
export async function urlFirmada(ruta: string): Promise<string | null> {
  const db = clienteServidor()
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(ruta, VALIDEZ_FIRMA)

  if (error || !data) return null
  return data.signedUrl
}

/** Borra un archivo. Silencioso: si ya no está, el resultado es el mismo. */
export async function borrarArchivo(ruta: string): Promise<void> {
  const db = clienteServidor()
  await db.storage.from(BUCKET).remove([ruta])
}

/** Tamaño legible, para mostrar junto al enlace. */
export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
