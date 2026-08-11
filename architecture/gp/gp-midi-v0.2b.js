// ======================================================
// GP MIDI v0.2
// MIDI + APC Mini
// Botones + faders declarados por sketch
// ======================================================

window.GP = window.GP || {}
window.GP.midi = window.GP.midi || {}
const midi = window.GP.midi

midi.output = midi.output || null
midi.active = midi.active || {}
midi.handlers = midi.handlers || {}
midi.activeButtons = midi.activeButtons || []
midi.activeFaders = midi.activeFaders || []
midi.faderValues = midi.faderValues || {}
midi.faderHandlers = midi.faderHandlers || {}
midi._ledInterval = null
midi._initialized = false
midi._registeredNotes = midi._registeredNotes || {}
midi._registeredCC = midi._registeredCC || {}

midi.FADER_CC = { F1: 48, F2: 49, F3: 50, F4: 51, F5: 52, F6: 53, F7: 54, F8: 55, FMASTER: 56 }
midi.FADER_LED = { F1: 64, F2: 65, F3: 66, F4: 67, F5: 68, F6: 69, F7: 70, F8: 71 }

midi.init = async function () {
  await loadScript('https://h.6120.eu/midi.js')
  await window.midi.start()

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

  for (const cc of Object.values(midi.FADER_CC)) {
    if (midi._registeredCC[cc]) continue
    window.midi.channel(0).onCC(cc, value => {
      const name = Object.keys(midi.FADER_CC).find(k => midi.FADER_CC[k] === cc)
      if (!midi.activeFaders.includes(name)) return
      midi.faderValues[name] = value / 127
      ;(midi.faderHandlers[name] || []).forEach(fn => fn(midi.faderValues[name]))
    })
    midi._registeredCC[cc] = true
  }

  midi._initialized = true
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

  midi._startLedLoop()
  return midi
}

midi.faders = function (names = []) {
  if (!midi.output) throw new Error('GP MIDI: call init() first')

  midi._stopLedLoop()
  midi._clearAllLeds()
  midi.activeFaders = [...new Set(names)]

  for (const name of midi.activeFaders) {
    if (!(name in midi.FADER_CC)) throw new Error(`GP MIDI: unknown fader ${name}`)
    midi.faderValues[name] = 0
    midi.faderHandlers[name] = []
    midi.output.send([0x90, midi.FADER_LED[name], 1])
  }

  midi._startLedLoop()
  return midi
}

midi.fader = function (name) {
  if (!(name in midi.FADER_CC)) throw new Error(`GP MIDI: unknown fader ${name}`)
  return midi.faderValues[name] ?? 0
}

midi.onFader = function (name, callback) {
  if (!(name in midi.FADER_CC)) throw new Error(`GP MIDI: unknown fader ${name}`)
  midi.faderHandlers[name] = midi.faderHandlers[name] || []
  midi.faderHandlers[name].push(callback)
  return midi
}

midi._startLedLoop = function () {
  midi._stopLedLoop()
  midi._ledInterval = setInterval(() => {
    for (const note of midi.activeButtons)
      midi.output.send([0x90, note, midi.active[note] ? 4 : 1])

    for (const name of midi.activeFaders) {
      const led = midi.FADER_LED[name]
      if (led !== undefined) midi.output.send([0x90, led, 1])
    }
  }, 50)
}

midi._stopLedLoop = function () {
  if (midi._ledInterval) {
    clearInterval(midi._ledInterval)
    midi._ledInterval = null
  }
}

midi._clearAllLeds = function () {
  if (!midi.output) return
  for (let note = 0; note <= 71; note++) midi.output.send([0x90, note, 0])
}

// Monitor visual de actividad MIDI de Hydra. No modifica LEDs.
midi.show = function (value = true) {
  if (!window.midi) return midi
  if (value) window.midi.show()
  else if (window.midi.hide) window.midi.hide()
  return midi
}

midi.on = function (note, callback) {
  if (!midi.activeButtons.includes(note)) throw new Error(`GP MIDI: button ${note} is not active`)
  midi.handlers[note] = midi.handlers[note] || []
  midi.handlers[note].push(callback)
  return midi
}

midi.reset = function () {
  midi._stopLedLoop()
  midi._clearAllLeds()
  midi.active = {}
  midi.handlers = {}
  midi.activeButtons = []
  midi.activeFaders = []
  midi.faderHandlers = {}
  return midi
}
