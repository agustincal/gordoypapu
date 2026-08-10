// Hydra Stems Base
// Songs + normalized APC Mini MIDI controls
//
// AUDIO:
//   STEMS.songs.Perdido.bass
//   STEMS.songs.Perdido.drums
//   STEMS.songs.Perdido.synth
//   STEMS.songs.Perdido.vocals
//
//   STEMS.songs.James.bass
//   STEMS.songs.James.drums
//   STEMS.songs.James.synth
//   STEMS.songs.James.vocals
//
// MIDI:
//   STEMS.F1()..STEMS.F8() -> CC48..CC55, normalized 0..1
//   STEMS.FMASTER()         -> CC56, normalized 0..1
//   STEMS.onNote('N11', fn) .. STEMS.onNote('N18', fn)
//                           -> Notes 56..63

const REPO_RAW = 'https://raw.githubusercontent.com/agustincal/gordoypapu/main/'

function stem(song, name) {
  const audio = new Audio(`${REPO_RAW}stems/${song.toLowerCase()}/${name}.mp3`)
  audio.preload = 'auto'
  return audio
}

// ============================================================
// AUDIO / STEMS
// ============================================================

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

// ============================================================
// MIDI / APC MINI
// ============================================================

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

for (const name of Object.keys(NOTES)) {
  noteCallbacks[name] = []
}

for (const [name, note] of Object.entries(NOTES)) {
  midi.channel(0).onNote(note, event => {
    noteCallbacks[name].forEach(callback => callback(event))
  })
}

const controls = {
  FADERS,
  NOTES,
  values: ccValues,
  F1: () => ccValues[48],
  F2: () => ccValues[49],
  F3: () => ccValues[50],
  F4: () => ccValues[51],
  F5: () => ccValues[52],
  F6: () => ccValues[53],
  F7: () => ccValues[54],
  F8: () => ccValues[55],
  FMASTER: () => ccValues[56],
  onNote: (name, callback) => {
    if (!noteCallbacks[name]) {
      throw new Error(`Unknown note control: ${name}`)
    }
    noteCallbacks[name].push(callback)
  }
}

// One stable public object for Hydra patches.
window.STEMS = {
  songs,
  ...controls
}
