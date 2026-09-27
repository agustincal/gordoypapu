// ============================================================
// GP_02_Buscando_Placer__loader
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: carga en orden los módulos de esta canción (midibase, tools, ensayo, visual)
// GP._rama controla la rama/tag de git a usar (default 'main')
// Cache-busting incluido: siempre pide la versión más fresca, sin depender de purgar/hard refresh
// Actualizado: 2026-09-27
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  window.GP._rama = window.GP._rama || 'main'
})()

window.GP_cargarModulosBuscandoPlacer = async function () {
  const GP_RAMA = window.GP._rama
  const GP_BASE = `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_RAMA}/produccion/02_Buscando_Placer/arquitectura/`
  const V = Date.now()

  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__midibase.js?t=' + V)
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__tools.js?t=' + V)
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__ensayo.js?t=' + V)
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__visual.js?t=' + V)
}