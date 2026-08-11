// ======================================================
// GP MIDI v0.2b
// MIDI + APC Mini
// Controles declarados por sketch
//
// Nota de desarrollo:
// Al cargar por primera vez, los botones se encienden.
// Para volver a encenderlos tras apagar show(), por ahora
// se refresca la página. Esto es intencional en esta prueba.
// ======================================================

window.GP = window.GP || {}
window.GP.midi = window.GP.midi || {}

const midi = window.GP.midi

midi.output = midi.output || null
midi.active = midi.active || {}
midi.handlers = midi.handlers || {}
midi.activeButtons = midi.activeButtons || []
midi._ledInterval = null
midi._initialized = false
midi.visible = true
midi._registeredNotes = midi._registeredNotes || {}

midi.init = async function () {
  await loadScript('https://h.6120.eu/midi.js')
  await window.midi.start().show()

  const access = await navigator.requestMIDIAccess()
  midi.output = [...access.outputs.values()][0]

  if (!midi.output) throw new Error('GP MIDI: no MIDI output found')

  for (let note = 0; note <= 63; note++) {
    if (midi._registeredNotes[note]) continue

    window.midi.channel(0).onNote(note, () => {
      if (!midi.activeButtons.includes(note)) return

      midi.active[note] = !midi.active[note]
      ;(midi.handlers[note] || []).forEach(fn => fn(midi.active[note]))
    })

    midi._registeredNotes[note] = true
  }

  midi._initialized = true
  midi.visible = true
  return midi
}

midi.buttons = function (notes = []) {
  if (!midi.output) throw new Error('GP MIDI: call init() first')

  midi.reset()
  midi.activeButtons = [...new Set(notes)]
  midi.visible = true

  for (const note of midi.activeButtons) {
    midi.active[note] = false
    midi.handlers[note] = []
    midi.output.send([0x90, note, 1])
  }

  midi._ledInterval = setInterval(() => {
    if (!midi.visible) return
    for (const note of midi.activeButtons)
      midi.output.send([0x90, note, midi.active[note] ? 4 : 1])
  }, 50)

  return midi
}

// Única acción para apagar/ocultar los LEDs.
midi.show = function (value = true) {
  midi.visible = !!value
  if (!midi.output) return midi

  for (const note of midi.activeButtons)
    midi.output.send([0x90, note, midi.visible ? (midi.active[note] ? 4 : 1) : 0])

  return midi
}

midi.on = function (note, callback) {
  if (!midi.activeButtons.includes(note))
    throw new Error(`GP MIDI: button ${note} is not active`)

  midi.handlers[note] = midi.handlers[note] || []
  midi.handlers[note].push(callback)
  return midi
}

midi.reset = function () {
  if (midi._ledInterval) {
    clearInterval(midi._ledInterval)
    midi._ledInterval = null
  }

  if (midi.output) {
    for (let note = 0; note <= 63; note++)
      midi.output.send([0x90, note, 0])
  }

  midi.active = {}
  midi.handlers = {}
  midi.activeButtons = []
  return midi
}
