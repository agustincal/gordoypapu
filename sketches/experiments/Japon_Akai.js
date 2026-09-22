await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-midi-base-AkaiMini-v0.9.js')
await GP.midi.start()
GP.midi.buttons([])

const BASE = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@e6536152dd00643708fbb5cc9105949eddd0b9dd/assets/sequence01/'
const imgs = ['01.jpg','02.jpg','03.jpg','04.jpg','05.jpg','06.jpg'].map(n => BASE + n)
imgs.forEach(u => { const im = new Image(); im.src = u })

const AKAI = /apc|akai/i
const MODO_PRUEBA = true

// ---- imágenes / zapping ----
let idx = 0
let TRANS = 0
s0.initImage(imgs[idx])
const siguiente = () => {
  idx = (idx + 1) % imgs.length
  TRANS = 1
  console.log('imagen:', imgs[idx])
  setTimeout(() => s0.initImage(imgs[idx]), 150)
}
if (window._gpTimer) clearInterval(window._gpTimer)

// ---- percusión / bajo ----
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

// ---- faders normalizados a 0..1 ----
const f1 = () => F1/127, f2 = () => F2/127, f4 = () => F4/127
const f6 = () => F6/127, f7 = () => F7/127

// ---- audio (voz por micrófono, solo bin 1, con zona muerta) ----
a.setBins(4); a.setSmooth(0.85); a.setScale(8); a.setCutoff(0.1)
a.show()
const DEAD = 0.2
const limpiar = v => v < DEAD ? 0 : (v - DEAD) / (1 - DEAD)
const VOZ = () => limpiar(Math.min(1, a.fft[0]))

// ---- MIDI: pads del Akai en modo prueba ----
if (window._gpMidi) window._gpMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    console.log('MIDI in:', inp.name)
    if (!AKAI.test(inp.name)) return
    const fn = m => {
      const [st, nota, vel] = m.data
      const tipo = st & 0xF0
      const on = tipo === 0x90 && vel > 0
      const off = tipo === 0x80 || (tipo === 0x90 && vel === 0)
      if (nota > 63) return
      const fila = Math.floor(nota / 8) + 1
      const col  = nota % 8
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

// ---- look VHS ----
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
  .modulate(iman(0, 0, 0), () => VOZ()*0.35)               // un solo imán, centrado, prueba bin 1
  .add(noise(400, 1.5).color(.1,.1,.1), () => 0.1 + f4()*3 + TRANS*1.5)
  .mult(osc(240, 0, 0).rotate(Math.PI/2).color(.25,.25,.25)
        .add(solid(.75,.75,.75), 1), () => 0.6 + f6()*0.4)
  .add(solid(() => fmt(tinte)[0], () => fmt(tinte)[1], () => fmt(tinte)[2]),
       () => BAJO*0.35)
  .saturate(() => Math.max(0, 0.9 - f7()*1.8 - TRANS*0.7))
  .contrast(.92).brightness(.03)
  .out()