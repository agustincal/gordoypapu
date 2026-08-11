// ======================================================
// GP MIDI v0.1
// Solo MIDI + APC Mini
// Sin audio. Sin Hydra.
// ======================================================

window.GP = window.GP || {}
window.GP.midi = window.GP.midi || {}

window.GP.midi.NOTE_START = 56
window.GP.midi.NOTE_END = 63
window.GP.midi.active = window.GP.midi.active || {}
window.GP.midi.output = null
window.GP.midi.ready = false
window.GP.midi._ledInterval = null
window.GP.midi._noteHandlers = window.GP.midi._noteHandlers || {}
window.GP.midi._handlersBound = window.GP.midi._handlersBound || false

window.GP.midi.init = async function () {
  // Si ejecutamos el script otra vez sin refrescar la página,
  // no volver a registrar onNote(): eso crea handlers duplicados.
  if (window.GP.midi.ready && window.GP.midi.output) {
    for (let n = 56; n <= 63; n++) {
      window.GP.midi.active[n] = false
      window.GP.midi.output.send([0x90, n, 1])
    }

    if (window.GP.midi._ledInterval)
      clearInterval(window.GP.midi._ledInterval)

    window.GP.midi._ledInterval = setInterval(() => {
      for (let n = 56; n <= 63; n++)
        window.GP.midi.output.send([
          0x90,
          n,
          window.GP.midi.active[n] ? 4 : 1
        ])
    }, 50)

    return window.GP.midi
  }

  await loadScript('https://h.6120.eu/midi.js')
  await midi.start().show()

  const access = await navigator.requestMIDIAccess()
  const output = [...access.outputs.values()][0]

  if (!output) throw new Error('GP MIDI: no MIDI output found')

  window.GP.midi.output = output

  // Limpieza completa 0–63
  for (let n = 0; n <= 63; n++)
    output.send([0x90, n, 0])

  // Fila 8: 56–63, verde fijo = listo
  for (let n = 56; n <= 63; n++) {
    window.GP.midi.active[n] = false
    output.send([0x90, n, 1])
  }

  // Registrar triggers una sola vez por página
  if (!window.GP.midi._handlersBound) {
    for (let n = 56; n <= 63; n++) {
      midi.channel(0).onNote(n, () => {
        window.GP.midi.active[n] = !window.GP.midi.active[n]

        if (window.GP.midi._noteHandlers[n])
          window.GP.midi._noteHandlers[n](window.GP.midi.active[n])
      })
    }

    window.GP.midi._handlersBound = true
  }

  // LEDs
  if (window.GP.midi._ledInterval)
    clearInterval(window.GP.midi._ledInterval)

  window.GP.midi._ledInterval = setInterval(() => {
    for (let n = 56; n <= 63; n++)
      output.send([0x90, n, window.GP.midi.active[n] ? 4 : 1])
  }, 50)

  // N81–N88
  for (let n = 56; n <= 63; n++)
    window.GP.midi[`N8${n - 55}`] = () => window.GP.midi.active[n]

  window.GP.midi.ready = true
  return window.GP.midi
}

window.GP.midi.on = function (note, callback) {
  window.GP.midi._noteHandlers[note] = callback
  return window.GP.midi
}

window.GP.midi.off = function (note) {
  delete window.GP.midi._noteHandlers[note]
  return window.GP.midi
}

window.GP.midi.clear = function () {
  if (window.GP.midi._ledInterval) {
    clearInterval(window.GP.midi._ledInterval)
    window.GP.midi._ledInterval = null
  }

  if (window.GP.midi.output)
    for (let n = 0; n <= 63; n++)
      window.GP.midi.output.send([0x90, n, 0])

  return window.GP.midi
}
