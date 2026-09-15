/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Hay un package-lock.json en el directorio padre (C:\Users\Personal) que
  // hace a Next elegirlo como raíz y avisar en cada arranque. Fijar la raíz
  // aquí la ancla al proyecto y silencia el aviso.
  outputFileTracingRoot: import.meta.dirname,
}

export default nextConfig
