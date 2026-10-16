// ============================================================
// test_tools
// Sketch mínimo para probar LIVE/arq/GP_tools.js
// (grabador + monitor MIDI + ensayo + LED del pad 98)
// Pad 98 o Ctrl+Alt+R: grabar / detener+guardar
// Actualizado: 2026-10-16
// ============================================================

const GP_SHA = 'main'
const GP_ARQ = `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/LIVE/arq/`

await loadScript(GP_ARQ + 'GP_tools.js')
GP.tools.init({ cancion: 'test_tools' })   // va en el nombre de los archivos grabados
GP.tools.panel()

// LED del pad 98: prendido = listo · parpadea = grabando · apagado = guardando
// (lo maneja GP_tools; si los valores no coinciden con tu Akai, cambialos acá)
GP.tools.led.nota = 98
GP.tools.led.on = 4
GP.tools.led.off = 1

navigator.requestMIDIAccess().then(acc => {
  const conectar = () => {
    acc.inputs.forEach(entrada => {
      if (entrada.state !== 'connected') return
      entrada.onmidimessage = (msg) => {
        const data = msg.data
        GP.tools.midi(entrada.name, data)   // graba todo + muestra en el panel

        const esNoteOn = (data[0] & 0xf0) === 0x90 && data[2] > 0
        if (esNoteOn) flash = 1
        if (esNoteOn && data[1] === 98 && /apc|akai/i.test(entrada.name)) GP.tools.grabadorCiclo()
      }
    })
    GP.tools.led.salida = null
    acc.outputs.forEach(o => {
      if (o.state === 'connected' && /apc|akai/i.test(o.name) && !/ensayo/i.test(o.name)) GP.tools.led.salida = o
    })
    GP.tools.led.pintar()   // pinta el LED al conectar
  }
  conectar()
  acc.onstatechange = conectar
})

// algo que se mueva, para ver que el video graba
var flash = 0
osc(20, 0.05, 1).rotate(() => time * 0.1)
  .mult(solid(1, 1, 1).add(solid(0, 1, 0), () => flash))
  .out()

update = (dt) => { flash = Math.max(0, flash - dt / 300) }
