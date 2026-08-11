// ======================================================
// GP MIDI v0.1
// Solo MIDI + APC Mini
// Sin audio. Sin Hydra.
// ======================================================

window.GP = window.GP || {}
GP.midi = GP.midi || {}

GP.midi.output = null
GP.midi.input = null
GP.midi.active = {}
GP.midi.NOTE_START = 56
GP.midi.NOTE_END = 63
GP.midi.ready = false
GP.midi._ledInterval = null
GP.midi._noteHandlers = {}

GP.midi.init = async function () {
  if (GP.midi.ready) return GP.midi

  await loadScript('https://h.6120.eu/midi.js')
  await midi.start().show()

  const access = await navigator.requestMIDIAccess()
  const outputs = [...access.outputs.values()]
  const inputs = [...access.inputs.values()]

  GP.midi.output = outputs[0] || null
  GP.midi.input = inputs[0] || null

  if (!GP.midi.output) throw new Error('GP MIDI: no MIDI output found')

  for (let n = 0; n <= 63; n++) GP.midi.output.send([0x90, n, 0])

  for (let n = GP.midi.NOTE_START; n <= GP.midi.NOTE_END; n++) {
    GP.midi.active[n] = false
    GP.midi.output.send([0x90, n, 1])
  }

  if (GP.midi._ledInterval) clearInterval(GP.midi._ledInterval)

  GP.midi._ledInterval = setInterval(() => {
    for (let n = GP.midi.NOTE_START; n <= GP.midi.NOTE_END; n++) {
      GP.midi.output.send([
        0x90,
        n,
        GP.midi.active[n] ? 4 : 1
      ])
    }
  }, 50)

  for (let n = GP.midi.NOTE_START; n <= GP.midi.NOTE_END; n++) {
    midi.channel(0).onNote(n, () => {
      GP.midi.active[n] = !GP.midi.active[n]

      if (GP.midi._noteHandlers[n])
        GP.midi._noteHandlers[n](GP.midi.active[n])
    })
  }

  for (let n = GP.midi.NOTE_START; n <= GP.midi.NOTE_END; n++) {
    GP.midi[`N8${n - 55}`] = () => GP.midi.active[n]
  }

  GP.midi.ready = true
  return GP.midi
}

GP.midi.on = function (note, callback) {
  GP.midi._noteHandlers[note] = callback
  return GP.midi
}

GP.midi.off = function (note) {
  delete GP.midi._noteHandlers[note]
  return GP.midi
}

GP.midi.clear = function () {
  if (GP.midi._ledInterval) {
    clearInterval(GP.midi._ledInterval)
    GP.midi._ledInterval = null
  }

  if (GP.midi.output) {
    for (let n = 0; n <= 63; n++)
      GP.midi.output.send([0x90, n, 0])
  }

  return GP.midi
}
