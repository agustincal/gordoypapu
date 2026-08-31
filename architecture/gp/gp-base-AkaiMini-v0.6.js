// ======================================================
// G&P — GP BASE AkaiMini v0.6
// MIDI + STEM AUDIO
//
// Si no hay MIDI conectado, GP.init() no falla:
// los controles quedan en 0 hasta que MIDI esté disponible.
// ======================================================
;(function () {
  window.GP = window.GP || {}

  if (window.GP.baseVersion === 'AkaiMini-v0.6') {
    console.info('[GP] base AkaiMini v0.6 ya está cargada')
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

  const MIDI_URL = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@647e3a624aceda63aec1dd994d015f86fc222008/architecture/gp/gp-midi-base-AkaiMini-v0.6.js'

  async function initMidi() {
    if (window.GP.midi && window.GP.midi.version === '0.6-AkaiMini') {
      return window.GP.midi
    }
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
  GP.baseVersion = 'AkaiMini-v0.6'

  console.info('[GP] base AkaiMini v0.6 cargada')
})()
