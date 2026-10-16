// ============================================================
// test_tools
// Sketch mínimo para probar LIVE/arq/GP_midi.js + GP_tools.js
// (botones, faders, LEDs, korg→akai, grabador, ensayo)
// Pad 98 o Ctrl+Alt+R: grabar / detener+guardar
// Actualizado: 2026-10-16
// ============================================================

// ---- carga de scripts ----
// GP_SHA = 'main'  → ensayo: trae lo último del push directo de GitHub (sin purgar)
// GP_SHA = '<hash completo del commit>' → show: jsDelivr fijo y rápido (sin purgar)
const GP_SHA = 'main'

const cargarGP = async (ruta) => {
  if (GP_SHA !== 'main') {
    await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/${ruta}`)
    return
  }
  const url = `https://raw.githubusercontent.com/agustincal/gordoypapu/main/${ruta}?t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`no encontré ${ruta} (${res.status})`)
  ;(0, eval)(await res.text())
}

await cargarGP('LIVE/arq/GP_midi.js')    // Akai: botones, faders y TODOS los LEDs
await cargarGP('LIVE/arq/GP_tools.js')   // ensayo: grabador, panel, reproductor
console.log(GP.midi.version, '· GP_tools', GP.tools._version)

GP.tools.init({ cancion: 'test_tools', padGrabador: 98 })
GP.tools.panel()

// LED del pad del grabador: prendido = listo · parpadea = grabando · apagado = guardando
GP.tools.led.on = 4
GP.tools.led.off = 1

await GP.midi.start()
GP.midi.buttons(['N11', 'N12']).faders(['F1', 'F2'])

// prueba de luces: el Korg prende pads del Akai mientras suena (lo de ayer, ahora a propósito)
const KORG_A_AKAI = true

GP.midi.alMensaje((nombre, data) => {
  const tipo = data[0] & 0xf0
  const esNoteOn = tipo === 0x90 && data[2] > 0
  const esNoteOff = tipo === 0x80 || (tipo === 0x90 && data[2] === 0)
  if (esNoteOn) flash = 1

  if (KORG_A_AKAI && /korg|padkontrol/i.test(nombre)) {
    const pad = data[1] % 64          // cualquier nota del Korg cae en un pad de la grilla
    if (esNoteOn) GP.midi.luz(pad, GP.midi.COLOR.verde)
    if (esNoteOff) GP.midi.luz(pad, 0)
  }
})

// algo que se mueva, para ver que el video graba
var flash = 0
osc(20, 0.05, 1).rotate(() => time * 0.1).scale(() => 1 + F1 / 127)
  .mult(solid(1, 1, 1).add(solid(0, 1, 0), () => flash))
  .out()

update = (dt) => { flash = Math.max(0, flash - dt / 300) }
