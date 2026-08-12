// ======================================================
// G&P — MIDI BASE v0.3
// APC Mini / Hydra
//
// Sketch API:
//   GP.midi.buttons(['N11', 'N24'])
//   GP.midi.faders(['F1', 'FMASTER'])
//
// Internal MIDI numbers never need to appear in the sketch.
// ======================================================
;(function () {
  window.GP = window.GP || {}

  if (window.GP.midi && window.GP.midi.version === '0.3') {
    console.info('[GP MIDI] v0.3 ya está cargado')
    return
  }

  const midi = {}

  const FADER_CC = {
    F1: 48,
    F2: 49,
    F3: 50,
    F4: 51,
    F5: 52,
    F6: 53,
    F7: 54,
    F8: 55,
    FMASTER: 56
  }

  const FADER_LED = {
    F1: 64,
    F2: 65,
    F3: 66,
    F4: 67,
    F5: 68,
    F6: 69,
    F7: 70,
    F8: 71
    // FMASTER intentionally has no LED.
  }

  // APC Mini 8x8 pad grid: N11..N88 -> MIDI notes 0..63.
  function buttonToNote(name) {
    const match = /^N([1-8])([1-8])$/i.exec(String(name).trim())
    if (!match) throw new Error(`GP MIDI: botón inválido "${name}". Usá N11..N88.`)

    const row = Number(match[1])
    const column = Number(match[2])
    return (row - 1) * 8 + (column - 1)
  }

  function faderToCC(name) {
    const key = String(name).trim().toUpperCase()
    const cc = FADER_CC[key]
    if (cc == null) throw new Error(`GP MIDI: fader inválido "${name}". Usá F1..F8 o FMASTER.`)
    return cc
  }

  const state = {
    status: 'idle',
    access: null,
    output: null,
    outputName: null,
    activeButtons: [],
    activeFaders: [],
    buttonState: {},
    faderValues: Object.fromEntries(Object.values(FADER_CC).map(cc => [cc, 0])),
    buttonHandlers: {},
    faderHandlers: {},
    monitorVisible: false,
    listenersRegistered: false,
    ledInterval: null
  }

  function sendLed(note, value) {
    if (state.output) state.output.send([0x90, note, value])
  }

  function clearLeds() {
    if (!state.output) return
    for (let note = 0; note <= 71; note++) sendLed(note, 0)
  }

  function paintActiveLeds() {
    for (const note of state.activeButtons) {
      sendLed(note, state.buttonState[note] ? 4 : 1)
    }

    for (const name of state.activeFaders) {
      const led = FADER_LED[name]
      if (led !== undefined) sendLed(led, 1)
    }
  }

  function stopLedLoop() {
    if (state.ledInterval) {
      clearInterval(state.ledInterval)
      state.ledInterval = null
    }
  }

  function startLedLoop() {
    stopLedLoop()
    state.ledInterval = setInterval(paintActiveLeds, 50)
  }

  function registerListeners() {
    if (state.listenersRegistered) return

    // This is intentionally the proven midi-base-v2 fader reader.
    window.midi.channel(0).onCC('*', ({ index, value }) => {
      if (index >= 48 && index <= 56) {
        state.faderValues[index] = value / 127
        for (const fn of state.faderHandlers[index] || []) {
          fn(state.faderValues[index])
        }
      }
    })

    // APC Mini 8x8 grid = notes 0..63.
    for (let note = 0; note <= 63; note++) {
      window.midi.channel(0).onNote(note, event => {
        if (!state.activeButtons.includes(note)) return

        state.buttonState[note] = !state.buttonState[note]
        paintActiveLeds()

        for (const fn of state.buttonHandlers[note] || []) {
          fn({
            note,
            active: state.buttonState[note],
            event
          })
        }
      })
    }

    state.listenersRegistered = true
  }

  midi.version = '0.3'

  midi.start = async function ({ outputName } = {}) {
    if (state.status === 'ready') return midi
    if (state.status === 'starting') return midi

    state.status = 'starting'

    try {
      await loadScript('https://h.6120.eu/midi.js')
      await window.midi.start()

      state.access = await navigator.requestMIDIAccess()
      const outputs = [...state.access.outputs.values()]
      const selected = outputName
        ? outputs.find(output => output.name === outputName)
        : outputs[0]

      if (!selected) throw new Error('GP MIDI: no MIDI output found')

      state.output = selected
      state.outputName = selected.name || 'Salida MIDI sin nombre'

      clearLeds()
      registerListeners()
      state.status = 'ready'

      console.info('[GP MIDI] v0.3 listo:', state.outputName)
      return midi
    } catch (error) {
      state.status = 'error'
      console.error('[GP MIDI] no se pudo iniciar', error)
      throw error
    }
  }

  // Despierta los botones declarados por el sketch.
  midi.buttons = function (names = []) {
    if (!state.output) throw new Error('GP MIDI: ejecutá await GP.midi.start() primero')

    stopLedLoop()
    clearLeds()

    const normalized = [...new Set(names.map(name => String(name).trim().toUpperCase()))]
    const notes = normalized.map(buttonToNote)

    state.activeButtons = notes
    state.buttonState = {}

    for (const note of notes) {
      state.buttonState[note] = false
      state.buttonHandlers[note] = []
    }

    paintActiveLeds()
    startLedLoop()
    return midi
  }

  // Estado del botón: true/false.
  midi.button = function (name) {
    return !!state.buttonState[buttonToNote(name)]
  }

  midi.on = function (name, callback) {
    const note = buttonToNote(name)
    if (!state.activeButtons.includes(note)) {
      throw new Error(`GP MIDI: botón ${name} no está activo`)
    }

    state.buttonHandlers[note] = state.buttonHandlers[note] || []
    state.buttonHandlers[note].push(callback)
    return midi
  }

  // Despierta los faders declarados por el sketch.
  midi.faders = function (names = []) {
    if (!state.output) throw new Error('GP MIDI: ejecutá await GP.midi.start() primero')

    stopLedLoop()
    clearLeds()

    const normalized = [...new Set(names.map(name => String(name).trim().toUpperCase()))]
    const ccs = normalized.map(faderToCC)

    state.activeFaders = normalized

    for (let i = 0; i < normalized.length; i++) {
      const name = normalized[i]
      const cc = ccs[i]

      state.faderValues[cc] = 0
      state.faderHandlers[cc] = []

      const led = FADER_LED[name]
      if (led !== undefined) sendLed(led, 1)
    }

    paintActiveLeds()
    startLedLoop()
    return midi
  }

  // Valor normalizado 0..1 del fader.
  midi.fader = function (name) {
    return state.faderValues[faderToCC(name)] ?? 0
  }

  midi.onFader = function (name, callback) {
    const cc = faderToCC(name)
    state.faderHandlers[cc] = state.faderHandlers[cc] || []
    state.faderHandlers[cc].push(callback)
    return midi
  }

  // Solo muestra/oculta el monitor de actividad MIDI de Hydra.
  // No toca los LEDs de los controles.
  midi.show = function (value = true) {
    state.monitorVisible = !!value
    if (!window.midi) return midi

    if (state.monitorVisible) window.midi.show()
    else if (window.midi.hide) window.midi.hide()

    return midi
  }

  midi.reset = function () {
    stopLedLoop()
    clearLeds()

    state.activeButtons = []
    state.activeFaders = []
    state.buttonState = {}
    state.buttonHandlers = {}
    state.faderHandlers = {}

    return midi
  }

  midi.devices = function () {
    if (!state.access) return { inputs: [], outputs: [] }
    return {
      inputs: [...state.access.inputs.values()].map(device => device.name),
      outputs: [...state.access.outputs.values()].map(device => device.name)
    }
  }

  midi.isReady = function () {
    return state.status === 'ready'
  }

  midi.state = state
  window.GP.midi = midi
  console.info('[GP MIDI] base v0.3 cargada; ejecutá await GP.midi.start()')
})()
