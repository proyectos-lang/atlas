'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

/**
 * Ilustración de bienvenida: la guía de ATLAS presentando las cinco
 * competencias.
 *
 * Es una sola imagen en tres capas. La segunda recorta a la guía para que
 * se balancee y la tercera recorta su mano; encima, unas tapas del color
 * del panel se desvanecen una a una y van descubriendo cada tarjeta.
 * Las coordenadas están en píxeles de la imagen original (1024×1536).
 */

const ANCHO = 1024
const ALTO = 1536
const IMAGEN = '/bienvenida-atlas.jpg'

const poligono = (puntos: [number, number][]) =>
  'polygon(' +
  puntos.map(([x, y]) => `${(x / ANCHO) * 100}% ${(y / ALTO) * 100}%`).join(',') +
  ')'

const GUIA = poligono([
  [330, 55], [450, 110], [465, 300], [445, 420], [470, 500], [470, 700], [465, 1000],
  [400, 1350], [440, 1450], [330, 1500], [200, 1490], [200, 1400], [225, 1340],
  [205, 780], [150, 590], [105, 400], [140, 200], [230, 90],
])

const MANO = poligono([
  [470, 495], [560, 490], [645, 505], [645, 530], [560, 548], [470, 570],
])

// Título, las cinco competencias y el mensaje final, en orden de aparición.
const TARJETAS: [number, number, number, number][] = [
  [540, 70, 985, 345],
  [555, 355, 680, 495],
  [690, 350, 820, 500],
  [825, 345, 960, 510],
  [585, 525, 735, 690],
  [765, 525, 910, 695],
  [545, 710, 980, 800],
]

const capa = { backgroundImage: `url(${IMAGEN})` }

export function BienvenidaAnimada({ className = '' }: { className?: string }) {
  // Cambiar la clave remonta el escenario y la animación vuelve a empezar.
  const [vuelta, setVuelta] = useState(0)

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        key={vuelta}
        className="bienvenida-escenario"
        role="img"
        aria-label="La guía de ATLAS presenta las competencias transversales: comunicación, pensamiento crítico, resolución de problemas, trabajo en equipo y aprendizaje autónomo."
      >
        <div className="bienvenida-capa" style={capa} />
        <div className="bienvenida-capa bienvenida-guia" style={{ ...capa, clipPath: GUIA }} />
        <div className="bienvenida-capa bienvenida-mano" style={{ ...capa, clipPath: MANO }} />
        {TARJETAS.map(([x1, y1, x2, y2], i) => (
          <div
            key={i}
            className="bienvenida-tapa"
            style={{
              left: `${(x1 / ANCHO) * 100}%`,
              top: `${(y1 / ALTO) * 100}%`,
              width: `${((x2 - x1) / ANCHO) * 100}%`,
              height: `${((y2 - y1) / ALTO) * 100}%`,
              animationDelay: `${0.8 + i * 1.1}s`,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setVuelta((v) => v + 1)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/25
                   bg-white/10 px-4 py-1.5 text-xs font-medium text-white/85
                   transition hover:bg-white/20 hover:text-white"
      >
        <RotateCcw size={13} aria-hidden />
        Repetir animación
      </button>
    </div>
  )
}
