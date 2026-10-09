// ============================================================
// 01_Fluorescente_v01.js
// Sketch principal de Fluorescente adaptado a la nueva arquitectura
// ============================================================

const GP_SHA = 'AQUÍ_VA_TU_SHA_DE_GITHUB'

await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/01_Fluorescente/arquitectura/GP_01_Fluorescente__loader.js`)
await GP_CARGAR_MODULOS_FLUORESCENTE ? GP_cargarModulosFluorescente(GP_SHA) : await GP_cargarModulosFluorescente(GP_SHA)

await midi.start({ channel: "*", input: "*" })
midi.show()

const S = GP.zapping.state

update = (dt) => {
  GP.zapping.update(dt)
}

midi.input('*').channel('*').onNote('*', (evt) => {
  GP.tools.log('MIDI', [evt.note, evt.velocity, evt.channel])
  GP.zapping.onNote(evt)
})

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