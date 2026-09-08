// En Vitest no hay frontera cliente/servidor. Se neutraliza 'server-only'
// SOLO para las pruebas; en la aplicación sigue activo y un import desde
// un componente cliente rompe la compilación.
export {}
