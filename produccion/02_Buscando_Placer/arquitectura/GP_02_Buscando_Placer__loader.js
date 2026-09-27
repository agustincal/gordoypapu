// ============================================================
// GP_02_Buscando_Placer__loader
// Canción 02 · Buscando Placer (Gordo y Papu)
// Rol: carga en orden los módulos de esta canción (midibase, tools, ensayo, visual)
// GP._rama controla la rama/tag de git a usar (default 'main')
// Actualizado: 2026-09-27
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  window.GP._rama = window.GP._rama || 'main'
})()

window.GP_cargarModulosBuscandoPlacer = async function () {
  const GP_RAMA = window.GP._rama
  const GP_BASE = `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_RAMA}/produccion/02_Buscando_Placer/arquitectura/`

  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__midibase.js')
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__tools.js')
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__ensayo.js')
  await loadScript(GP_BASE + 'GP_02_Buscando_Placer__visual.js')
}