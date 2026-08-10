// Hydra Stems Base
// Songs + normalized APC Mini MIDI controls

const REPO_RAW = 'https://raw.githubusercontent.com/agustincal/gordoypapu/main/'

function stem(song, name) {
  const audio = new Audio(`${REPO_RAW}stems/${song.toLowerCase()}/${name}.mp3`)
  audio.preload = 'auto'
  return audio
}

const songs = {
  Perdido: {
    bass: stem('perdido', 'bass'),
    drums: stem('perdido', 'drums'),
    synth: stem('perdido', 'synth'),
    vocals: stem('perdido', 'vocals')
  },
  James: {
    bass: stem('james', 'bass'),
    drums: stem('james', 'drums'),
    synth: stem('james', 'synth'),
    vocals: stem('james', 'vocals')
  }
}

// Publish the audio API immediately.
window.STEMS = { songs }

// MIDI is initialized separately so the base script itself does not
// depend on top-level await.
;(async () => {
  await loadScript('https://h.6120.eu/midi.js')
  await midi.start().show()

  const ccValues = Array(128).fill(0)

  const FADERS = {
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

  const NOTES = {
    N11: 56,
    N12: 57,
    N13: 58,
    N14: 59,
    N15: 60,
    N16: 61,
    N17: 62,
    N18: 63
  }

  midi.channel(0).onCC('*', ({ index, value }) => {
    if (index >= 48 && index <= 56) {
      ccValues[index] = value / 127
    }
  })

  const noteCallbacks = {}
  Object.keys(NOTES).forEach(name => noteCallbacks[name] = [])

  for (const [name, note] of Object.entries(NOTES)) {
    midi.channel(0).onNote(note, event => {
      noteCallbacks[name].forEach(callback => callback(event))
    })
  }

  window.STEMS.FADERS = FADERS
  window.STEMS.NOTES = NOTES
  window.STEMS.values = ccValues
  window.STEMS.F1 = () => ccValues[48]
  window.STEMS.F2 = () => ccValues[49]
  window.STEMS.F3 = () => ccValues[50]
  window.STEMS.F4 = () => ccValues[51]
  window.STEMS.F5 = () => ccValues[52]
  window.STEMS.F6 = () => ccValues[53]
  window.STEMS.F7 = () => ccValues[54]
  window.STEMS.F8 = () => ccValues[55]
  window.STEMS.FMASTER = () => ccValues[56]
  window.STEMS.onNote = (name, callback) => {
    if (!noteCallbacks[name]) throw new Error(`Unknown note control: ${name}`)
    noteCallbacks[name].push(callback)
  }
})()
