// Hydra Stems Base
// Songs + stems + normalized APC Mini MIDI controls
//
// Audio:
//   SONGS.Perdido.bass
//   SONGS.Perdido.drums
//   SONGS.Perdido.synth
//   SONGS.Perdido.vocals
//
//   SONGS.James.bass
//   SONGS.James.drums
//   SONGS.James.synth
//   SONGS.James.vocals
//
// MIDI:
//   F1..F8    -> CC48..CC55, normalized 0..1
//   FMASTER   -> CC56, normalized 0..1
//   N11..N18  -> Note 56..63, trigger callbacks

await loadScript('https://h.6120.eu/midi.js')
await midi.start().show()

// ============================================================
// AUDIO / STEMS
// ============================================================

const REPO_RAW = 'https://raw.githubusercontent.com/agustincal/gordoypapu/main/'

function stem(song, name) {
  const audio = new Audio(`${REPO_RAW}stems/${song.toLowerCase()}/${name}.mp3`)
  audio.preload = 'auto'
  audio.load()
  return audio
}

const SONGS = {
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

// Public audio collection.
globalThis.SONGS = SONGS

// ============================================================
// MIDI / APC MINI
// ============================================================

const access = await navigator.requestMIDIAccess()
const output = [...access.outputs.values()][0]

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

// Read normalized fader values.
midi.channel(0).onCC('*', ({ index, value }) => {
  if (index >= 48 && index <= 56) {
    ccValues[index] = value / 127
  }
})

// Public fader functions: F1() ... F8(), FMASTER().
for (const [name, cc] of Object.entries(FADERS)) {
  globalThis[name] = () => ccValues[cc]
}

// Register trigger callbacks without exposing MIDI note numbers.
const noteCallbacks = Object.fromEntries(
  Object.keys(NOTES).map(name => [name, []])
)

for (const [name, note] of Object.entries(NOTES)) {
  midi.channel(0).onNote(note, event => {
    noteCallbacks[name].forEach(callback => callback(event))
  })
}

function onNote(name, callback) {
  if (!noteCallbacks[name]) {
    throw new Error(`Unknown note control: ${name}`)
  }

  noteCallbacks[name].push(callback)
}

globalThis.MIDI = {
  FADERS,
  NOTES,
  values: ccValues,
  onNote
}

// Example:
// onNote('N11', () => console.log('N11 trigger'))
// F1()      -> 0..1
// FMASTER() -> 0..1
