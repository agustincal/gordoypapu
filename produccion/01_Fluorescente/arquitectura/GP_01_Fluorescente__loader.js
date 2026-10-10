// ============================================================
// GP_01_Fluorescente__loader.js
// Cargador modular central para Fluorescente (Gordo y Papu)
// ============================================================

window.GP_cargarModulosFluorescente = async function(sha) {
  const base = `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${sha}/produccion/01_Fluorescente/arquitectura/`
  
  await loadScript(base + 'GP_01_Fluorescente__midibase.js')
  await loadScript(base + 'GP_01_Fluorescente__tools.js')
  await loadScript(base + 'GP_01_Fluorescente__ensayo.js')
  await loadScript(base + 'GP_01_Fluorescente__visual.js')
  
  console.log('Módulos de Fluorescente cargados correctamente.')
}