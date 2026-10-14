// ============================================================
// GP_03_Vociferan__loader.js
// Canción: 03_Vociferan (Gordo y Papu)
// Rol: carga los 4 módulos de la canción desde jsDelivr, fijados a una rama o commit
// Depende de / lo carga: lo carga el sketch; el sketch llama GP_cargarModulosVociferan(GP_SHA)
// Actualizado: 14/10/2026 (carga directa desde GitHub con respaldo jsDelivr)
// ============================================================

window.GP_cargarModulosVociferan = async function (sha = 'main') {
  const ruta = 'produccion/03_Vociferan/arquitectura/'
  const modulos = [
    'GP_03_Vociferan__midibase.js',
    'GP_03_Vociferan__tools.js',
    'GP_03_Vociferan__ensayo.js',
    'GP_03_Vociferan__visual.js',
  ]
  // GP_cargar lo define el sketch: baja de GitHub (o jsDelivr de respaldo)
  // y avisa con un error claro si un archivo no llega
  const cargar = window.GP_cargar
    || (r => loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${sha}/${r}`))
  for (const m of modulos) await cargar(ruta + m, sha)

  console.log('Vociferan: módulos cargados desde @' + sha)
}
