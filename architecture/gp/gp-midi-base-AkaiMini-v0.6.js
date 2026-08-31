// ======================================================
// G&P — MIDI BASE AkaiMini v0.6
// APC Mini / Hydra
//
// API directa para los sketches:
//   F1 .. F8, FMASTER  → valores de fader normalizados
//   N11 .. N88         → estados de botones 0/1
//
// v0.6: conserva los últimos valores MIDI de los faders
// durante un refresh de la página.
// Sin MIDI conectado, los controles permanecen disponibles
// con valor 0 hasta que MIDI pueda iniciarse.
// ======================================================
;(function () {
  window.GP = window.GP || {}

  if (window.GP.midi && window.GP.midi.version === '0.6-AkaiMini') {
    console.info('[GP MIDI] AkaiMini v0.6 ya está cargada')
    return
  }

  const midi = {}
  const STORAGE_KEY = 'GP_AkaiMini_Faders_v0.6'

  const FADER_CC = {
    F1: 48, F2: 49, F3: 50, F4: 51,
    F5: 52, F6: 53, F7: 54, F8: 55,
    FMASTER: 56
  }

  const FADER_LED = {
    F1: 64, F2: 65, F3: 66, F4: 67,
    F5: 68, F6: 69, F7: 70, F8: 71
  }

  function buttonToNote(name) {
    const match = /^N([1-8])([1-8])$/i.exec(String(name).trim())
    if (!match) throw new Error(`GP MIDI: botón inválido "${name}". Usá N11..N88.`)
    return (Number(match[1]) - 1) * 8 + (Number(match[2]) - 1)
  }

  function faderToCC(name) {
    const key = String(name).trim().toUpperCase()
    const cc = FADER_CC[key]
    if (cc == null) throw new Error(`GP MIDI: fader inválido "${name}". Usá F1..F8 o FMASTER.`)
    return cc
  }

  function loadSavedFaders() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      for (const cc of Object.values(FADER_CC)) {
        if (typeof saved[cc] === 'number') state.faderValues[cc] = saved[cc]
      }
    } catch (_) {}
  }

  function saveFader(cc, value) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      saved[cc] = value
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch (_) {}
  }

  const state = {
    status: 'idle', access: null, output: null, outputName: null,
    activeButtons: [], activeFaders: [], buttonState: {},
    faderValues: Object.fromEntries(Object.values(FADER_CC).map(cc => [cc, 0])),
    buttonHandlers: {}, faderHandlers: {}, monitorVisible: false,
    listenersRegistered: false, ledInterval: null
  }

  loadSavedFaders()

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

  function installDirectGlobals() {
    for (const name of Object.keys(FADER_CC)) {
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => state.faderValues[FADER_CC[name]] ?? 0
      })
    }

    for (let row = 1; row <= 8; row++) {
      for (let column = 1; column <= 8; column++) {
        const name = `N${row}${column}`
        Object.defineProperty(window, name, {
          configurable: true,
          get: () => !!state.buttonState[buttonToNote(name)]
        })
      }
    }
  }

  function registerListeners() {
    if (state.listenersRegistered) return

    const channel = window.midi.channel(0)

    channel.onCC('*', ({ index, value }) => {
      if (index >= 48 && index <= 56) {
        state.faderValues[index] = value
        saveFader(index, value)
        for (const fn of state.faderHandlers[index] || []) fn(value)
      }
    })

    for (let note = 0; note <= 63; note++) {
      channel.onNote(note, event => {
        if (!state.activeButtons.includes(note)) return
        state.buttonState[note] = !state.buttonState[note]
        paintActiveLeds()
        for (const fn of state.buttonHandlers[note] || []) {
          fn({ note, active: state.buttonState[note], event })
        }
      })
    }

    state.listenersRegistered = true
  }

  midi.version = '0.6-AkaiMini'

  midi.start = async function ({ outputName } = {}) {
    if (state.status === 'ready') return midi
    if (state.status === 'starting') return midi
    state.status = 'starting'

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/hydra-midi@0.4.3/dist/index.js')
      await window.midi.start({ input: '*', channel: '*' })

      state.access = await navigator.requestMIDIAccess()
      const outputs = [...state.access.outputs.values()]
      const selected = outputName ? outputs.find(o => o.name === outputName) : outputs[0]
      if (!selected) {
        state.status = 'idle'
        state.output = null
        state.outputName = null
        console.info('[GP MIDI] sin controladora: usando valores por defecto')
        return midi
      }

      state.output = selected
      state.outputName = selected.name || 'Salida MIDI sin nombre'
      clearLeds()
      registerListeners()
      installDirectGlobals()
      state.status = 'ready'
      paintActiveLeds()
      return midi
    } catch (error) {
      state.status = 'idle'
      state.output = null
      state.outputName = null
      console.info('[GP MIDI] MIDI no disponible: usando valores por defecto')
      return midi
    }
  }

  midi.buttons = function (names = []) {
    stopLedLoop(); clearLeds()
    const normalized = [...new Set(names.map(n => String(n).trim().toUpperCase()))]
    state.activeButtons = normalized.map(buttonToNote)
    state.buttonState = {}
    for (const note of state.activeButtons) {
      state.buttonState[note] = false
      state.buttonHandlers[note] = []
    }
    installDirectGlobals()
    if (state.output) {
      paintActiveLeds(); startLedLoop()
    }
    return midi
  }

  midi.button = name => !!state.buttonState[buttonToNote(name)]

  midi.on = function (name, callback) {
    const note = buttonToNote(name)
    if (!state.activeButtons.includes(note)) throw new Error(`GP MIDI: botón ${name} no está activo`)
    state.buttonHandlers[note] = state.buttonHandlers[note] || []
    state.buttonHandlers[note].push(callback)
    return midi
  }

  midi.faders = function (names = []) {
    stopLedLoop(); clearLeds()
    const normalized = [...new Set(names.map(n => String(n).trim().toUpperCase()))]
    state.activeFaders = normalized
    for (const name of normalized) {
      const cc = faderToCC(name)
      state.faderHandlers[cc] = []
      const led = FADER_LED[name]
      if (led !== undefined && state.output) sendLed(led, 1)
    }
    installDirectGlobals()
    if (state.output) {
      paintActiveLeds(); startLedLoop()
    }
    return midi
  }

  midi.fader = name => state.faderValues[faderToCC(name)] ?? 0

  midi.onFader = function (name, callback) {
    const cc = faderToCC(name)
    state.faderHandlers[cc] = state.faderHandlers[cc] || []
    state.faderHandlers[cc].push(callback)
    return midi
  }

  midi.show = function (value = true) {
    state.monitorVisible = !!value
    if (!window.midi) return midi
    if (state.monitorVisible) window.midi.show()
    else if (window.midi.hide) window.midi.hide()
    return midi
  }

  midi.reset = function () {
    stopLedLoop(); clearLeds()
    state.activeButtons = []; state.activeFaders = []
    state.buttonState = {}; state.buttonHandlers = {}; state.faderHandlers = {}
    return midi
  }

  midi.devices = function () {
    if (!state.access) return { inputs: [], outputs: [] }
    return {
      inputs: [...state.access.inputs.values()].map(d => d.name),
      outputs: [...state.access.outputs.values()].map(d => d.name)
    }
  }

  midi.isReady = () => state.status === 'ready'
  midi.state = state
  window.GP.midi = midi
  console.info('[GP MIDI] base AkaiMini v0.6 cargada')
})()
