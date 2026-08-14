// ======================================================
// G&P — GP BASE v0.5
// MIDI + STEM AUDIO
//
// Punto único de entrada para los sketches.
// MIDI: F1..F8, FMASTER, N11..N88
// Audio: bass / drums / synth / vocals
// ======================================================
;(function () {
  window.GP = window.GP || {}

  if (window.GP.baseVersion === '0.5') {
    console.info('[GP] base v0.5 ya está cargada')
    return
  }

  // ------------------------------------------------------
  // AUDIO
  // ------------------------------------------------------

  const audio = {}
  const audioState = {
    song: null,
    ctx: null,
    stems: {},
    started: false
  }

  function createStem(name, song) {
    if (audioState.stems[name]) return audioState.stems[name]

    const player = new Audio(
      `https://agustincal.github.io/gordoypapu/stems/${song}/${name}.mp3`
    )

    player.crossOrigin = 'anonymous'
    player.loop = true

    const source = audioState.ctx.createMediaElementSource(player)
    const analyser = audioState.ctx.createAnalyser()
    analyser.fftSize = 1024

    source.connect(analyser)
    source.connect(audioState.ctx.destination)

    const fft = new Uint8Array(analyser.frequencyBinCount)
    setInterval(() => analyser.getByteFrequencyData(fft), 1000 / 60)

    const obj = {
      player,
      analyser,
      fft,
      low() { return this.fft[8] / 255 },
      mid() { return this.fft[40] / 255 },
      high() { return this.fft[100] / 255 }
    }

    audioState.stems[name] = obj
    audio[name] = obj
    window[name] = obj
    return obj
  }

  audio.init = function ({ song = 'vociferan' } = {}) {
    if (audioState.ctx && audioState.song === song) return audio

    if (audioState.ctx) {
      Object.values(audioState.stems).forEach(stem => stem.player.pause())
    }

    audioState.song = song
    audioState.ctx = new AudioContext()
    audioState.stems = {}

    for (const name of ['bass', 'drums', 'synth', 'vocals']) {
      createStem(name, song)
    }

    audio.stems = audioState.stems
    return audio
  }

  audio.start = async function () {
    if (!audioState.ctx) audio.init()

    await audioState.ctx.resume()
    await Promise.all(
      Object.values(audioState.stems).map(stem => stem.player.play())
    )

    audioState.started = true
    return audio
  }

  audio.stop = function () {
    Object.values(audioState.stems).forEach(stem => stem.player.pause())
    audioState.started = false
    return audio
  }

  audio.pause = audio.stop
  audio.stems = audioState.stems
  audio.state = audioState

  // ------------------------------------------------------
  // MIDI
  // ------------------------------------------------------

  // La versión está fijada para que todos los equipos usen la misma base.
  const MIDI_URL = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@d1e6851831b1a9b2c41ab35d4d26206dff6bd614/architecture/gp/gp-midi-base-v0.4.js'

  async function initMidi() {
    if (window.GP.midi && window.GP.midi.version === '0.4') return window.GP.midi
    await loadScript(MIDI_URL)
    await window.GP.midi.start()
    return window.GP.midi
  }

  GP.init = async function ({ song = 'vociferan', midi = true } = {}) {
    audio.init({ song })

    if (midi) {
      await initMidi()
    }

    return GP
  }

  GP.audio = audio
  GP.baseVersion = '0.5'

  console.info('[GP] base v0.5 cargada')
})()
