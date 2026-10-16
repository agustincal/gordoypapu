// ============================================================
// test_tools
// Sketch mínimo para probar LIVE/arq/GP_midi.js + GP_tools.js
// (botones, faders, LEDs, filas de disparo + mute, grabador, ensayo)
// Pad 89 o Ctrl+Alt+R: grabar / detener+guardar
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

GP.tools.init({ cancion: 'test_tools' })   // grabador en el pad 89 (default)
GP.tools.panel()

// LED del pad 89: prendido = listo · parpadea = grabando · apagado = guardando

await GP.midi.start()
GP.midi.buttons(['N11', 'N12']).faders(['F1', 'F2'])

// ---- filas de disparo (5-8): una fila por canal ----
// botón derecho de cada fila = mute (8→82, 7→83, 6→84, 5→85)
GP.midi.filas({
  8: { canal: 10, pulso: true },        // batería: pulso en toda la fila
  7: { canal: 1,  rango: [25, 48] },    // línea principal
  6: { canal: 2,  rango: [57, 86] },    // melodía aguda
  5: null,                              // reservada para el canal que va a venir
})

// un solo evento para todo disparo, venga del Korg o de tu mano
GP.midi.alDisparo(({ fila, columna, nota, on, origen }) => {
  if (!on) return
  flash = 1
  // console.log('disparo', fila, columna, nota, origen)
})

// algo que se mueva, para ver que el video graba
var flash = 0
osc(20, 0.05, 1).rotate(() => time * 0.1).scale(() => 1 + F1 / 127)
  .mult(solid(1, 1, 1).add(solid(0, 1, 0), () => flash))
  .out()

update = (dt) => { flash = Math.max(0, flash - dt / 300) }
