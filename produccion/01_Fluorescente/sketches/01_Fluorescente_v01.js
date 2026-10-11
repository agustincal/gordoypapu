// ============================================================
// 01_Fluorescente_v01.js
// Sketch principal de Fluorescente adaptado a la nueva arquitectura
// ============================================================

const GP_SHA = '6cc0f46c2a7b0c5e02b42575ffc91e9a5c6d4620' // Reemplazá con tu SHA de GitHub

await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/01_Fluorescente/arquitectura/GP_01_Fluorescente__loader.js`)

// Llamada anclada a window para evitar el error de "not defined" en Hydra
await window.GP_cargarModulosFluorescente(GP_SHA)

// Usamos tu propio módulo MIDI (GP.midi) en lugar de la librería genérica "midi"
await GP.midi.start({ outputName: 'APC MINI' }) // Podés dejar 'APC MINI' o '' según uses

// Referenciamos el estado expuesto por el motor visual de Fluorescente
const S = GP.zapping.state

// Bucle de actualización de tiempo y decaimientos (fases, energía, etc.)
update = (dt) => {
  GP.zapping.update(dt)
}

// Escuchamos las notas MIDI entrantes usando la API nativa y las derivamos al motor
if (window._gpFluorescenteMidi) window._gpFluorescenteMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpFluorescenteMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    const fn = m => {
      const [st, nota, vel] = m.data
      
      // Opcional: logueamos el evento en tu panel de tools
      if (GP.tools && GP.tools.log) {
        GP.tools.log('MIDI', [nota, vel, st & 0x0F])
      }

      const tipo = st & 0xF0
      const on = tipo === 0x90 && vel > 0
      const canal = (st & 0x0F)
      
      if (on) {
        // Procesamos la nota en el motor visual (ataques, colores, batería)
        GP.zapping.onNote({ note: nota, velocity: vel, channel: canal })
      }
    }
    inp.addEventListener('midimessage', fn)
    window._gpFluorescenteMidi.push([inp, fn])
  })
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