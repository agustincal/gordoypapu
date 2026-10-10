// ============================================================
// 01_Fluorescente_v01.js
// Sketch principal de Fluorescente adaptado a la nueva arquitectura
// ============================================================

const GP_SHA = 'AQUÍ_VA_TU_SHA_DE_GITHUB' // Reemplazá con tu SHA de GitHub

await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/01_Fluorescente/arquitectura/GP_01_Fluorescente__loader.js`)

// Llamada anclada a window para evitar el error de "not defined" en Hydra
await window.GP_cargarModulosFluorescente(GP_SHA)

// Inicializamos el MIDI nativo de Hydra para capturar las notas musicales
await midi.start({ channel: "*", input: "*" })
midi.show()

// Referenciamos el estado expuesto por el motor visual de Fluorescente
const S = GP.zapping.state

// Bucle de actualización de tiempo y decaimientos (fases, energía, etc.)
update = (dt) => {
  GP.zapping.update(dt)
}

// Escuchamos las notas MIDI entrantes y las derivamos al motor
midi.input('*').channel('*').onNote('*', (evt) => {
  // Opcional: logueamos el evento en tu panel de tools
  if (GP.tools && GP.tools.log) {
    GP.tools.log('MIDI', [evt.note, evt.velocity, evt.channel])
  }
  
  // Procesamos la nota en el motor visual (ataques, colores, batería)
  GP.zapping.onNote(evt)
})

// ============================================================
// PIPELINE VISUAL DE FLUORESCENTE
// ============================================================

osc(() => 3 + S.arp.pitch * 30, 0, 0)
  .scrollX(() => S.arp.phase * 0.2)
  .color(() => S.arpRGB[0], () => S.arpRGB[1], () => S.arpRGB[2])
  
  .diff(
    osc(() => 20 + S.arp.pitch * 40, 0, 0)
      .scrollX(() => -S.arp.phase * 0.1)
      .pixelate(() => 8 + S.arp.energy * 16 + S.drum.hat * 20)
      .kaleid(2)
  )
  
  .colorama(0.005)
  .luma()
  
  .modulate(
    osc(() => 2 + S.bass.pitch * 6, 0, 0)
      .scrollY(() => S.bass.phase * 0.1),
    () => 0.05 + S.bass.energy * 0.4
  )
  
  .brightness(() => S.drum.snare * 0.3)
  .scale(() => 1.5 + S.drum.kick * 0.3)
  .out()