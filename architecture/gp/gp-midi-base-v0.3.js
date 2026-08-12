// ======================================================
// G&P — MIDI BASE v0.3
// APC Mini / Hydra
// Derivada de midi-base-v2.js (probada en Hydra)
//
// Principio: la lectura MIDI probada no se cambia.
// - CC 48..56: faders, normalizados 0..1
// - Notas: botones declarados por el sketch
// - LEDs 64..71: indicadores de F1..F8
// - FMASTER (CC56): sin LED
// - GP.midi.show(): solo monitor MIDI visual
// ======================================================
;(function () {
  window.GP = window.GP || {}

  if (window.GP.midi && window.GP.midi.version === '0.3') {
    console.info('[GP MIDI] v0.3 ya está cargado')
    return
  }

  const midi = {}

  const FADER_CC_START = 48
  const FADER_CC_END = 56
  const FADER_LED = {
    48: 64,
    49: 65,
    50: 66,
    51: 67,
    52: 68,
    53: 69,
    54: 70,
    55: 71
    // 56 = FMASTER, sin LED
  }

  const state = {
    status: 'idle',
    access: null,
    output: null,
    outputName: null,
    activeButtons: [],
    activeFaders: [],
    buttonState: {},
    faderValues: Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [FADER_CC_START + i, 0])
    ),
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

    for (const cc of state.activeFaders) {
      const led = FADER_LED[cc]
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

    // IMPORTANTE: esta es la forma probada en midi-base-v2.
    // El objeto { index, value } es entregado por midi.js.
    window.midi.channel(0).onCC('*', ({ index, value }) => {
      if (index >= FADER_CC_START && index <= FADER_CC_END) {
        state.faderValues[index] = value / 127
        for (const fn of state.faderHandlers[index] || []) {
          fn(state.faderValues[index])
        }
      }
    })

    // Registramos las notas una sola vez. El sketch decide cuáles despertar.
    for (let note = 0; note <= 127; note++) {
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

      if (!selected) {
        throw new Error('GP MIDI: no MIDI output found')
      }

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

  // Despierta botones usando exactamente los identificadores MIDI declarados.
  midi.buttons = function (notes = []) {
    if (!state.output) throw new Error('GP MIDI: ejecutá await GP.midi.start() primero')

    stopLedLoop()
    clearLeds()

    state.activeButtons = [...new Set(notes.map(Number))]
    state.buttonState = {}

    for (const note of state.activeButtons) {
      if (note < 0 || note > 127) {
        throw new Error(`GP MIDI: invalid button note ${note}`)
      }
      state.buttonState[note] = false
      state.buttonHandlers[note] = state.buttonHandlers[note] || []
    }

    paintActiveLeds()
    startLedLoop()
    return midi
  }

  midi.on = function (note, callback) {
    note = Number(note)
    if (!state.activeButtons.includes(note)) {
      throw new Error(`GP MIDI: button ${note} is not active`)
    }

    state.buttonHandlers[note] = state.buttonHandlers[note] || []
    state.buttonHandlers[note].push(callback)
    return midi
  }

  // Despierta faders por CC exacto. El sketch decide cuáles necesita.
  midi.faders = function (ccs = []) {
    if (!state.output) throw new Error('GP MIDI: ejecutá await GP.midi.start() primero')

    stopLedLoop()
    clearLeds()

    state.activeFaders = [...new Set(ccs.map(Number))]

    for (const cc of state.activeFaders) {
      if (cc < FADER_CC_START || cc > FADER_CC_END) {
        throw new Error(`GP MIDI: invalid fader CC ${cc}`)
      }

      state.faderValues[cc] = 0
      state.faderHandlers[cc] = []

      const led = FADER_LED[cc]
      if (led !== undefined) sendLed(led, 1)
    }

    paintActiveLeds()
    startLedLoop()
    return midi
  }

  // Valor normalizado 0..1 del CC exacto.
  midi.fader = function (cc) {
    cc = Number(cc)
    if (cc < FADER_CC_START || cc > FADER_CC_END) {
      throw new Error(`GP MIDI: invalid fader CC ${cc}`)
    }
    return state.faderValues[cc] ?? 0
  }

  midi.onFader = function (cc, callback) {
    cc = Number(cc)
    if (cc < FADER_CC_START || cc > FADER_CC_END) {
      throw new Error(`GP MIDI: invalid fader CC ${cc}`)
    }
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
