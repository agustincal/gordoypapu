// ======================================================
// GP MIDI v0.2
// MIDI + APC Mini
// Controles declarados por sketch
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

// APC Mini faders: CC 48-55 = F1-F8, CC 56 = FMASTER
// Buttons above F1-F8: notes 64-71
midi.FADER_CC_START = 48
midi.FADER_CC_END = 56
midi.FADER_LED = { 48: 64, 49: 65, 50: 66, 51: 67, 52: 68, 53: 69, 54: 70, 55: 71 }

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

  for (let cc = midi.FADER_CC_START; cc <= midi.FADER_CC_END; cc++) {
    if (midi._registeredCC[cc]) continue
    window.midi.channel(0).onCC(cc, value => {
      if (!midi.activeFaders.includes(cc)) return
      midi.faderValues[cc] = value / 127
      ;(midi.faderHandlers[cc] || []).forEach(fn => fn(midi.faderValues[cc]))
    })
    midi._registeredCC[cc] = true
  }

  midi._initialized = true
  return midi
}

// Despierta los faders indicados por su CC exacto, tal como aparece en el monitor MIDI.
midi.faders = function (ccs = []) {
  if (!midi.output) throw new Error('GP MIDI: call init() first')

  midi._stopLedLoop()
  midi._clearAllLeds()
  midi.activeFaders = [...new Set(ccs)]

  for (const cc of midi.activeFaders) {
    if (cc < midi.FADER_CC_START || cc > midi.FADER_CC_END)
      throw new Error(`GP MIDI: invalid fader CC ${cc}`)

    midi.faderValues[cc] = 0
    midi.faderHandlers[cc] = []

    const led = midi.FADER_LED[cc]
    if (led !== undefined) midi.output.send([0x90, led, 1])
  }

  midi._startLedLoop()
  return midi
}

// Valor normalizado 0-1 del CC indicado.
midi.fader = function (cc) {
  if (cc < midi.FADER_CC_START || cc > midi.FADER_CC_END)
    throw new Error(`GP MIDI: invalid fader CC ${cc}`)
  return midi.faderValues[cc] ?? 0
}

midi.onFader = function (cc, callback) {
  if (cc < midi.FADER_CC_START || cc > midi.FADER_CC_END)
    throw new Error(`GP MIDI: invalid fader CC ${cc}`)
  midi.faderHandlers[cc] = midi.faderHandlers[cc] || []
  midi.faderHandlers[cc].push(callback)
  return midi
}

midi._startLedLoop = function () {
  midi._stopLedLoop()
  midi._ledInterval = setInterval(() => {
    for (const note of midi.activeButtons)
      midi.output.send([0x90, note, midi.active[note] ? 4 : 1])

    for (const cc of midi.activeFaders) {
      const led = midi.FADER_LED[cc]
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
