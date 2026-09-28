// ============================================================
// GP_02_Buscando_Placer__loader
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: carga en orden los módulos de esta canción (midibase, tools, ensayo, visual)
// Recibe el SHA/rama desde el sketch — así todo el pinning se maneja en un solo lugar
// Actualizado: 2026-09-27
// ============================================================

window.GP_cargarModulosBuscandoPlacer = async function (rama = 'main') {
  window.GP_RAMA = rama // nuevo: disponible para cualquier módulo (ej. overlay de estado en ensayo.js)
  const GP_BASE = `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${rama}/produccion/02_Buscando_Placer/arquitectura/`
  ...

  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__midibase.js')
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__tools.js')
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__ensayo.js')
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__visual.js')
}