// ======================================================
// G&P — MIDI BASE v2
// Cargable con await loadScript() desde Hydra.
// No usa await al nivel superior.
// ======================================================
;(function () {
  window.GP = window.GP || {}

  if (window.GP.midi && window.GP.midi.version === '2') {
    console.info('[GP MIDI] v2 ya está cargado')
    return
  }

  const NOTE_START = 56
  const NOTE_END = 63
  const FADER_CC = {
    F1: 48, F2: 49, F3: 50, F4: 51,
    F5: 52, F6: 53, F7: 54, F8: 55,
    FMASTER: 56
  }

  const state = {
    status: 'idle',
    output: null,
    outputName: null,
    active: Object.fromEntries(
      Array.from({ length: NOTE_END - NOTE_START + 1 }, (_, i) => [NOTE_START + i, false])
    ),
    faders: Object.fromEntries(Object.values(FADER_CC).map(cc => [cc, 0])),
    callbacks: Object.fromEntries(
      Array.from({ length: NOTE_END - NOTE_START + 1 }, (_, i) => [NOTE_START + i, []])
    )
  }

  function padToNote(pad) {
    const number = Number(pad)
    if (number >= NOTE_START && number <= NOTE_END) return number
    if (number >= 1 && number <= 8) return NOTE_START + number - 1
    throw new Error(`Pad inválido: ${pad}. Usá 1..8 o nota 56..63.`)
  }

  function sendLed(note, color) {
    if (state.output) state.output.send([0x90, note, color])
  }

  function paintPads() {
    for (let note = NOTE_START; note <= NOTE_END; note++) {
      sendLed(note, state.active[note] ? 4 : 1)
    }
  }

  function chooseOutput(name) {
    const outputs = [...(navigator.requestMIDIAccess ? [] : [])]
    void outputs

    const accessOutputs = [...state.access.outputs.values()]
    const selected = name
      ? accessOutputs.find(output => output.name === name)
      : accessOutputs[0]

    if (!selected) {
      throw new Error('No se encontró una salida MIDI. Conectá el controlador y volvé a ejecutar GP.midi.start().')
    }

    state.output = selected
    state.outputName = selected.name || 'Salida MIDI sin nombre'
  }

  const api = {
    version: '2',

    async start({ outputName } = {}) {
      if (state.status === 'ready') return api
      if (state.status === 'starting') return api

      state.status = 'starting'

      try {
        await loadScript('https://h.6120.eu/midi.js')
        await midi.start().show()

        state.access = await navigator.requestMIDIAccess()
        chooseOutput(outputName)

        for (let note = 0; note <= 63; note++) sendLed(note, 0)
        paintPads()

        midi.channel(0).onCC('*', ({ index, value }) => {
          if (index >= 48 && index <= 56) state.faders[index] = value / 127
        })

        for (let note = NOTE_START; note <= NOTE_END; note++) {
          midi.channel(0).onNote(note, event => {
            state.active[note] = !state.active[note]
            paintPads()
            state.callbacks[note].forEach(callback => {
              callback({ note, active: state.active[note], event })
            })
          })
        }

        state.status = 'ready'
        console.info('[GP MIDI] listo:', state.outputName)
        return api
      } catch (error) {
        state.status = 'error'
        console.error('[GP MIDI] no se pudo iniciar', error)
        throw error
      }
    },

    devices() {
      if (!state.access) return { inputs: [], outputs: [] }
      return {
        inputs: [...state.access.inputs.values()].map(device => device.name),
        outputs: [...state.access.outputs.values()].map(device => device.name)
      }
    },

    isReady() {
      return state.status === 'ready'
    },

    pad(pad) {
      return state.active[padToNote(pad)]
    },

    onPad(pad, callback) {
      const note = padToNote(pad)
      state.callbacks[note].push(callback)
      return () => {
        state.callbacks[note] = state.callbacks[note].filter(fn => fn !== callback)
      }
    },

    fader(name) {
      const cc = FADER_CC[name]
      if (cc == null) throw new Error(`Fader desconocido: ${name}`)
      return state.faders[cc]
    },

    setPad(pad, active) {
      const note = padToNote(pad)
      state.active[note] = Boolean(active)
      sendLed(note, state.active[note] ? 4 : 1)
    },

    clearPads() {
      for (let note = NOTE_START; note <= NOTE_END; note++) {
        state.active[note] = false
      }
      paintPads()
    },

    state
  }

  window.GP.midi = api
  console.info('[GP MIDI] base v2 cargada; ejecutá await GP.midi.start()')
})()
