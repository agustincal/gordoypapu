// ============================================================
// test_tools
// Sketch mínimo para probar LIVE/arq/GP_tools.js
// (grabador + monitor MIDI + ensayo + LED del pad 98)
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

await cargarGP('LIVE/arq/GP_tools.js')
console.log('GP_tools', GP.tools._version)

GP.tools.init({ cancion: 'test_tools', padGrabador: 98 })
GP.tools.panel()

// LED del pad: prendido = listo · parpadea = grabando · apagado = guardando
GP.tools.led.on = 4
GP.tools.led.off = 1

// MIDI: una sola conexión aunque reevalúes el sketch.
// GP_tools ya graba, muestra en el panel y maneja el pad 98;
// acá va sólo lo propio del sketch.
GP.tools.conectarMidi({
  alMensaje: (nombre, data) => {
    const esNoteOn = (data[0] & 0xf0) === 0x90 && data[2] > 0
    if (esNoteOn) flash = 1
  }
})

// algo que se mueva, para ver que el video graba
var flash = 0
osc(20, 0.05, 1).rotate(() => time * 0.1)
  .mult(solid(1, 1, 1).add(solid(0, 1, 0), () => flash))
  .out()

update = (dt) => { flash = Math.max(0, flash - dt / 300) }
