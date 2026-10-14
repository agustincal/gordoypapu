// ============================================================
// GP_02_Buscando_Placer__loader
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: carga en orden los módulos de esta canción (midibase, tools, ensayo, visual)
// Recibe el SHA/rama desde el sketch — así todo el pinning se maneja en un solo lugar
// Actualizado: 2026-10-14 (carga directa desde GitHub con respaldo jsDelivr; error claro si falta un archivo)
// ============================================================

window.GP_cargarModulosBuscandoPlacer = async function (rama = 'main') {
  window.GP_RAMA = rama // disponible para cualquier módulo (ej. overlay de estado en ensayo.js)
  const ruta = 'produccion/02_Buscando_Placer/arquitectura/'
  const modulos = [
    'GP_02_Buscando_Placer__midibase.js',
    'GP_02_Buscando_Placer__tools.js',
    'GP_02_Buscando_Placer__ensayo.js',
    'GP_02_Buscando_Placer__visual.js',
  ]
  // GP_cargar lo define el sketch (desde la v03): baja de GitHub, con jsDelivr
  // de respaldo, y avisa con un error claro si un archivo no llega.
  // Los sketches viejos (v01, v02) no lo definen y siguen cargando como antes.
  const cargar = window.GP_cargar
    || (r => loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${rama}/${r}`))
  for (const m of modulos) await cargar(ruta + m, rama)

  console.log('Buscando Placer: módulos cargados desde @' + rama)
}
