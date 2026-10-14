// ============================================================
// GP_03_Vociferan__loader.js
// Canción: 03_Vociferan (Gordo y Papu)
// Rol: carga los 4 módulos de la canción desde jsDelivr, fijados a una rama o commit
// Depende de / lo carga: lo carga el sketch; el sketch llama GP_cargarModulosVociferan(GP_SHA)
// Actualizado: 14/10/2026
// ============================================================

window.GP_cargarModulosVociferan = async function (sha = 'main') {
  const base = `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${sha}/produccion/03_Vociferan/arquitectura/`

  await loadScript(base + 'GP_03_Vociferan__midibase.js')
  await loadScript(base + 'GP_03_Vociferan__tools.js')
  await loadScript(base + 'GP_03_Vociferan__ensayo.js')
  await loadScript(base + 'GP_03_Vociferan__visual.js')

  console.log('Vociferan: módulos cargados desde @' + sha)
}
