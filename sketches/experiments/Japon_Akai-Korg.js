await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-midi-base-AkaiMini-v0.9.js')
await GP.midi.start()
GP.midi.buttons([])

const BASE = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@e6536152dd00643708fbb5cc9105949eddd0b9dd/assets/sequence01/'
const imgs = ['01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg'].map(n => BASE + n)
imgs.forEach(u => { const im = new Image(); im.src = u })

const AKAI = /apc|akai/i
const KORG = /korg|padkontrol/i
const MODO_PRUEBA = false   // true = simular el Korg con las filas 5-7 del Akai. false = usar el Korg real.
const ROL = { synth: 1, bajo: 2, percusion: 3 }   // canal MIDI de cada instrumento en el Korg (a confirmar)

// ================= PANEL MIDI EN PANTALLA =================
;(() => {
  let panel = document.getElementById('gp-midi-panel')
  if (panel) return
  panel = document.createElement('div')
  panel.id = 'gp-midi-panel'
  panel.style.cssText = `
    position:fixed; top:8px; left:8px; z-index:99999;
    background:rgba(0,0,0,0.75); color:#0f0; font:12px monospace;
    padding:8px 10px; border-radius:6px; max-width:360px;
    max-height:220px; overflow:hidden; white-space:pre; line-height:1.4;
  `
  document.body.appendChild(panel)
})()

window._gpLog = window._gpLog || []
function logMidi(origen, canal, tipo, nota, vel) {
  const linea = `${origen} · ch${canal} · ${tipo} · nota${nota} · vel${vel}`
  window._gpLog.unshift(linea)
  window._gpLog = window._gpLog.slice(0, 12)
  const panel = document.getElementById('gp-midi-panel')
  if (panel) panel.textContent = window._gpLog.join('\n')
}

// ================= IMÁGENES / ZAPPING =================
let idx = 0
let TRANS = 0
s0.initImage(imgs[idx])
const siguiente = () => {
  idx = (idx + 1) % imgs.length
  TRANS = 1
  setTimeout(() => s0.initImage(imgs[idx]), 150)
}
if (window._gpTimer) clearInterval(window._gpTimer)

// ================= ESTADO =================
let SWX = 0, SWY = 0
let BAJO = 0, bajoTarget = 0, tinte = 0
let dir = 1
const fmt = h => [0,1,2].map(n => 0.5 + 0.5*Math.sin(6.283*(h + n/3)))

const notaSynth     = () => siguiente()
const notaPercusion = v => { SWX += dir*(0.05 + 0.3)*v; dir = -dir }
const notaBajoOn    = (v, hue) => { bajoTarget = 1; BAJO = Math.max(BAJO, v); tinte = hue }
const notaBajoOff   = () => { bajoTarget = 0 }

update = () => {
  TRANS *= 0.95
  SWX *= 0.9; SWY *= 0.9
  BAJO += (bajoTarget - BAJO) * 0.08
  if (bajoTarget === 0) BAJO *= 0.96
}

// ================= FADERS (0..127 crudo → 0..1) =================
const f1 = () => F1/127, f2 = () => F2/127, f4 = () => F4/127
const f6 = () => F6/127, f7 = () => F7/127

// ================= VOZ (micrófono, bin 1, zona muerta) =================
a.setBins(4); a.setSmooth(0.85); a.setScale(8); a.setCutoff(0.1)
a.show()
const DEAD = 0.2
const limpiar = v => v < DEAD ? 0 : (v - DEAD) / (1 - DEAD)
const VOZ = () => limpiar(Math.min(1, a.fft[0]))

// ================= MIDI =================
if (window._gpMidi) window._gpMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    console.log('MIDI in:', inp.name)
    const esAkai = AKAI.test(inp.name), esKorg = KORG.test(inp.name)
    if (!esAkai && !esKorg) return

    const fn = m => {
      const [st, nota, vel] = m.data
      const tipo = st & 0xF0
      const canal = (st & 0x0F) + 1
      const on  = tipo === 0x90 && vel > 0
      const off = tipo === 0x80 || (tipo === 0x90 && vel === 0)
      const nombreTipo = on ? 'ON' : off ? 'off' : 'cc'

      // ---- Korg real ----
      if (esKorg && !MODO_PRUEBA) {
        logMidi('KORG', canal, nombreTipo, nota, vel)
        if (on) {
          const v = vel/127
          if (canal === ROL.synth) notaSynth()
          if (canal === ROL.percusion) notaPercusion(v)
          if (canal === ROL.bajo) notaBajoOn(v, (nota % 12) / 12)
        }
        if (off && canal === ROL.bajo) notaBajoOff()
        return
      }
      if (esKorg) return   // Korg ignorado mientras estemos en modo prueba

      if (!esAkai || nota > 63) return
      const fila = Math.floor(nota / 8) + 1
      const col  = nota % 8
      logMidi('AKAI', canal, nombreTipo, nota, vel)

      // ---- filas 5-7: modo prueba (simulan el Korg) ----
      if (MODO_PRUEBA && fila >= 5) {
        const v = (col + 1) / 8
        if (on) {
          if (fila === 5) notaSynth()
          if (fila === 6) notaBajoOn(v, col / 8)
          if (fila === 7) notaPercusion(v)
        }
        if (off && fila === 6) notaBajoOff()
      }
    }
    inp.addEventListener('midimessage', fn)
    window._gpMidi.push([inp, fn])
  })
})

// ================= LOOK VHS =================
const banda = () => osc(1, 0, 0).rotate(Math.PI/2)
  .scrollY(() => -time*0.08).thresh(.93, .03)

const iman = (px, py, fase) => shape(64, 0.2, 0.9)
  .scroll(() => px + 0.015*Math.sin(time*0.4 + fase), () => py + 0.015*Math.cos(time*0.3 + fase))
  .mult(noise(3, .3), 1)

const c = () => 0.006 + f2()*0.2 + TRANS*0.03

src(s0).color(1,0,0).scrollX(() => c())
  .add(src(s0).color(0,1,0), 1)
  .add(src(s0).color(0,0,1).scrollX(() => -c()), 1)
  .scrollY(() => TRANS*0.35 + SWY)
  .scrollX(() => SWX)
  .modulateScrollX(noise(2, .4).pixelate(1, 120), () => 0.01 + f1()*0.6 + TRANS*0.2)
  .modulateScrollX(banda().mult(noise(3, .3)), () => TRANS*0.1)
  .modulate(iman(0, 0, 0), () => VOZ()*0.35)
  .add(noise(400, 1.5).color(.1,.1,.1), () => 0.1 + f4()*3 + TRANS*1.5)
  .mult(osc(240, 0, 0).rotate(Math.PI/2).color(.25,.25,.25)
        .add(solid(.75,.75,.75), 1), () => 0.6 + f6()*0.4)
  .add(solid(() => fmt(tinte)[0], () => fmt(tinte)[1], () => fmt(tinte)[2]),
       () => BAJO*0.35)
  .saturate(() => Math.max(0, 0.9 - f7()*1.8 - TRANS*0.7))
  .contrast(.92).brightness(.03)
  .out()