// ============================================================
// GP_01_Fluorescente__midibase.js
// Controlador MIDI genérico para la Akai Mini / PadKONTROL
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  if (GP.midi && GP.midi._version === 'v1.0') return

  GP.midi = { _version: 'v1.0' }

  let midiAccess = null
  let activeInputs = []
  let outputDevice = null

  GP.midi.start = async ({ channel = '*', input = '*', outputName = '' } = {}) => {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API no soportada en este navegador.')
      return
    }
    midiAccess = await navigator.requestMIDIAccess()
    
    midiAccess.outputs.forEach(out => {
      if (outputName && out.name.toLowerCase().includes(outputName.toLowerCase())) {
        outputDevice = out
      }
    })

    GP.midi.state = { output: outputDevice }
  }

  GP.midi.buttons = (btns) => {}
  GP.midi.faders = (fds) => {}
})()