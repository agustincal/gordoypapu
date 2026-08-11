// ======================================================
// GP MIDI v0.2
// MIDI + APC Mini
// Controles declarados por sketch
// ======================================================

window.GP = window.GP || {}
window.GP.midi = window.GP.midi || {}

const midi = window.GP.midi

midi.output = null
midi.active = midi.active || {}
midi.handlers = midi.handlers || {}
midi.activeButtons = midi.activeButtons || []
midi.ready = false
midi.visible = true
midi._ledInterval = null
midi._initialized = false
midi._registeredNotes = midi._registeredNotes || {}

midi.init = async function () {
  if (midi._initialized && midi.output) return midi

  await loadScript('https://h.6120.eu/midi.js')
  await window.midi.start().show()

  const access = await navigator.requestMIDIAccess()
  midi.output = [...access.outputs.values()][0]

  if (!midi.output) throw new Error('GP MIDI: no MIDI output found')

  // Registrar cada nota una sola vez. Los callbacks quedan fuera
  // del registro MIDI para permitir re-ejecutar el sketch sin fantasmas.
  for (let note = 0; note <= 63; note++) {
    if (midi._registeredNotes[note]) continue

    window.midi.channel(0).onNote(note, () => {
      if (!midi.activeButtons.includes(note)) return

      midi.active[note] = !midi.active[note]
      const handlers = midi.handlers[note] || []
      handlers.forEach(fn => fn(midi.active[note]))
    })

    midi._registeredNotes[note] = true
  }

  midi._initialized = true
  midi.ready = true
  return midi
}

midi.buttons = function (notes = []) {
  if (!midi.output) throw new Error('GP MIDI: call init() first')

  midi.reset()
  midi.activeButtons = [...new Set(notes)]

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

midi.on = function (note, callback) {
  if (!midi.activeButtons.includes(note))
    throw new Error(`GP MIDI: button ${note} is not active`)

  midi.handlers[note] = midi.handlers[note] || []
  midi.handlers[note].push(callback)
  return midi
}

midi.show = function (value = true) {
  midi.visible = !!value
  if (!midi.output) return midi

  for (const note of midi.activeButtons)
    midi.output.send([0x90, note, midi.visible ? (midi.active[note] ? 4 : 1) : 0])

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
