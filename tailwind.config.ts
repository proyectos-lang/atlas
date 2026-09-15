import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

/**
 * Sistema de diseño ATLAS (§9 del plan).
 * La geometría reproduce el informe original: lienzo 1920x1080,
 * banda superior de 89 px, barra lateral de 218 px.
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './componentes/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        institucional: {
          DEFAULT: '#1F3864', // banda, barra lateral, títulos
          claro: '#2E4A7D',
suave: '#F7F9FC',   // fondo de tarjeta destacada
        },
        superficie: {
          pagina: '#F5F6F8',
          tarjeta: '#FFFFFF',
          borde: '#E1E5EA',
        },
        grafico: {
          barra: '#2E86DE',
          matriz: '#E8D44D',
        },
        // Escala de dominio (§5 del enunciado). Única fuente: lib/kpi/escala.ts
        nivel: {
          basico: '#C0392B',
          satisfactorio: '#F2C14E',
          'satisfactorio-texto': '#3D2F00',
          alto: '#57A773',
          excelente: '#1B7F4B',
        },
        texto: {
          secundario: '#6B7280',
        },
      },
      spacing: {
        banda: '89px',
        lateral: '218px',
      },
      borderRadius: {
        tarjeta: '8px',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [animate],
}

export default config
