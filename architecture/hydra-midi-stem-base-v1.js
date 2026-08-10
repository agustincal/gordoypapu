// ======================================================
// HYDRA MIDI + STEM BASE v1
// Arquitectura base funcional
// ======================================================

await loadScript('https://h.6120.eu/midi.js')
await midi.start().show()

const output = [...(await navigator.requestMIDIAccess()).outputs.values()][0]

// BOTONES MIDI — FILA 8
const NOTE_START = 56
const NOTE_END = 63

if (window.__APC_LED_INTERVAL) clearInterval(window.__APC_LED_INTERVAL)
for (let n = 0; n <= 63; n++) output.send([0x90, n, 0])

const activo = {}
for (let n = NOTE_START; n <= NOTE_END; n++) {
  activo[n] = false
  output.send([0x90, n, 1])
  midi.channel(0).onNote(n, () => activo[n] = !activo[n])
}

window.__APC_LED_INTERVAL = setInterval(() => {
  for (let n = NOTE_START; n <= NOTE_END; n++)
    output.send([0x90, n, activo[n] ? 4 : 1])
}, 50)

window.STEMS = window.STEMS || {}
for (let n = NOTE_START; n <= NOTE_END; n++)
  window.STEMS[`N8${n - 55}`] = () => activo[n]

// STEM ENGINE v0.3 — COMPACTO
window.ctx = window.ctx || new AudioContext()
window.stems = window.stems || {}

function stem(name) {
  if (window.stems[name]) {
    window[name] = window.stems[name]
    return window.stems[name]
  }

  const player = new Audio(`https://agustincal.github.io/gordoypapu/stems/vociferan/${name}.mp3`)
  player.crossOrigin = 'anonymous'
  player.loop = true

  const source = ctx.createMediaElementSource(player)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  source.connect(analyser)
  source.connect(ctx.destination)

  const fft = new Uint8Array(analyser.frequencyBinCount)
  setInterval(() => analyser.getByteFrequencyData(fft), 1000 / 60)

  player.play()

  const obj = {
    player,
    analyser,
    fft,
    low() { return this.fft[8] / 255 },
    mid() { return this.fft[40] / 255 },
    high() { return this.fft[100] / 255 }
  }

  stems[name] = obj
  window[name] = obj
  return obj
}

stem('bass')
stem('drums')
stem('synth')
stem('vocals')
