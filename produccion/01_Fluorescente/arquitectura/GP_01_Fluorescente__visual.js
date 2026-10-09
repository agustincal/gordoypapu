// ============================================================
// GP_01_Fluorescente__visual.js
// Motor visual para Fluorescente (Arpegios, Bajo, Batería, Fases)
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  if (GP.zapping && GP.zapping._version === 'v1.0') return

  GP.zapping = { _version: 'v1.0' }

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
  const msToRate = ms => clamp(250 / Math.max(ms, 1), 0.1, 2)

  function noteToRGB(note) {
    let hue = ((note % 12) * 30) / 360
    let i = Math.floor(hue * 6)
    let f = hue * 6 - i
    let q = 1 - f
    let t = f
    switch (i % 6) {
      case 0: return [1, t, 0]
      case 1: return [q, 1, 0]
      case 2: return [0, 1, t]
      case 3: return [0, q, 1]
      case 4: return [t, 0, 1]
      case 5: return [1, 0, q]
    }
  }

  const S = {
    arp:  { name: 'arp', ch: 0, pitchLo: 36, pitchHi: 96, H: {}, newest: null, lastDur: 250, pitch: 0.5, energy: 0, rate: 1, phase: 0 },
    bass: { name: 'bass', ch: 1, pitchLo: 24, pitchHi: 60, H: {}, newest: null, lastDur: 250, pitch: 0.5, energy: 0, rate: 1, phase: 0 },
    drum: { kick: 0, snare: 0, hat: 0 },
    arpRGB: [1, 0, 0],
    arpTarget: [1, 0, 0]
  }

  GP.zapping.state = S

  GP.zapping.onNote = ({ note, velocity, channel }) => {
    const v = velocity > 1 ? velocity / 127 : velocity
    if (channel === 0) {
      S.arp.pitch = clamp((note - S.arp.pitchLo) / (S.arp.pitchHi - S.arp.pitchLo))
      S.arp.energy = v
      S.arpTarget = noteToRGB(note)
    }
    if (channel === 1) {
      S.bass.pitch = clamp((note - S.bass.pitchLo) / (S.bass.pitchHi - S.bass.pitchLo))
      S.bass.energy = v
    }
    if (channel === 9) {
      const KICKS = [35, 36]
      const SNARES = [38, 40]
      const HATS = [42, 44, 46]
      if (KICKS.includes(note))  S.drum.kick  = v
      if (SNARES.includes(note)) S.drum.snare = v
      if (HATS.includes(note))   S.drum.hat   = v
    }
  }

  function pollVoice(v, now) {
    let newest = null
    for (let n = 0; n <= 127; n++) {
      let on = false
      try { on = _note(n, v.ch) > 0 } catch (e) {}

      if (on && v.H[n] == null) v.H[n] = now
      if (!on && v.H[n] != null) {
        v.lastDur = now - v.H[n]
        delete v.H[n]
      }
      if (on && (newest === null || v.H[n] > v.H[newest])) newest = n
    }
    v.newest = newest
  }

  function stepVoice(v, k, now) {
    const ms = v.newest !== null ? now - v.H[v.newest] : v.lastDur
    v.rate += (msToRate(ms) - v.rate) * clamp(k * 3)
    v.phase += k * v.rate
    v.energy *= Math.exp(-k / 0.35)
  }

  GP.zapping.update = (dt) => {
    const k = dt / 1000
    const now = performance.now()

    pollVoice(S.arp, now)
    pollVoice(S.bass, now)
    stepVoice(S.arp, k, now)
    stepVoice(S.bass, k, now)

    S.drum.kick  *= Math.exp(-k / 0.25)
    S.drum.snare *= Math.exp(-k / 0.20)
    S.drum.hat   *= Math.exp(-k / 0.10)

    for (let i = 0; i < 3; i++) {
      S.arpRGB[i] += (S.arpTarget[i] - S.arpRGB[i]) * clamp(k * 8)
    }
  }
})()