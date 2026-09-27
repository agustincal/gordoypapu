// ============================================================
// 02_Buscando_Placer_v01
// (zappingVideos-MidiCtrl — estados por canal 16 + ráfaga + ritmo por partes)
// Validado en ensayo 25/9 y 24/9. Producción — Gordo y Papu, Buscando Placer.
// ============================================================

await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-midi-base-AkaiMini-v0.9.js')
await GP.midi.start({ outputName: 'APC MINI' })
GP.midi.buttons(['N11', 'N81', 'N82', 'N83', 'N84', 'N85', 'N86', 'N87', 'N88'])
GP.midi.faders(['F1', 'F2', 'F3', 'F4', 'F5', 'F6'])

await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-midi-tools-v0.1.js')
GP.tools.atajosTeclado()

// tool de ensayo (opcional): reproduce audio + reinyecta MIDI grabado por puertos
// virtuales, para practicar sin depender del hardware. Sacalo de acá cuando
// termines de ensayar — no toca nada del resto del sketch.
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-midi-tools-ensayo-v0.1.js')

const BASE_IMAGENES = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/assets/sequence01/'
const videos = ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg'].map(n => BASE_IMAGENES + n)
const VIDEO_ASPECT = 1
const AJUSTE = 1

const AKAI = /apc|akai/i
const KORG = /korg|padkontrol/i
const MODO_PRUEBA = false
const ROL = { disparo: { canales: [2, 3], nota: 60 } }

const ESTADOS = [
  { f1: 0.1, f2: 0.2, f3: 0.3, f4: 0.5, f5: 0.4, f6: 0.1, usaIman: false, usaColorPantalla: true,  usaBarrido: true  },
  { f1: 0.3, f2: 0.5, f3: 0.6, f4: 0.7, f5: 0.5, f6: 0.2, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
  { f1: 0.6, f2: 0.1, f3: 0.4, f4: 0.3, f5: 0.7, f6: 0.4, usaIman: false, usaColorPantalla: false, usaBarrido: true  },
  { f1: 0.2, f2: 0.8, f3: 0.2, f4: 0.9, f5: 0.3, f6: 0.6, usaIman: true,  usaColorPantalla: true,  usaBarrido: false },
  { f1: 0.7, f2: 0.4, f3: 0.8, f4: 0.5, f5: 0.6, f6: 0.3, usaIman: false, usaColorPantalla: true,  usaBarrido: true  },
  { f1: 0.4, f2: 0.6, f3: 0.5, f4: 0.4, f5: 0.8, f6: 0.5, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
  { f1: 0.9, f2: 0.3, f3: 0.7, f4: 0.6, f5: 0.2, f6: 0.7, usaIman: false, usaColorPantalla: false, usaBarrido: true  },
  { f1: 0.5, f2: 0.9, f3: 0.3, f4: 0.8, f5: 0.5, f6: 0.9, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
  { f1: 0.3, f2: 0.2, f3: 0.9, f4: 0.2, f5: 0.9, f6: 0.4, usaIman: true,  usaColorPantalla: true,  usaBarrido: true  },
  { f1: 0.8, f2: 0.7, f3: 0.6, f4: 1.0, f5: 0.7, f6: 1.0, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
]
let estadoActual = 0

let f1s = 0, f2s = 0, f3s = 0, f4s = 0, f5s = 0, f6s = 0
const SUAVIZADO = 0.15
const RANGO_AJUSTE = 0.3
const clamp01 = v => Math.max(0, Math.min(1, v))
const conEstado = (base, fRaw) => clamp01(base + (fRaw - 0.5) * 2 * RANGO_AJUSTE)

const f1 = () => conEstado(ESTADOS[estadoActual].f1, f1s)
const f2 = () => conEstado(ESTADOS[estadoActual].f2, f2s)
const f3 = () => conEstado(ESTADOS[estadoActual].f3, f3s)
const f4 = () => conEstado(ESTADOS[estadoActual].f4, f4s)
const f5 = () => conEstado(ESTADOS[estadoActual].f5, f5s)
const f6 = () => conEstado(ESTADOS[estadoActual].f6, f6s)

const pixelSize = () => 600 - (f2() ** 3) * 595
const escalaExtra = () => 1 + (f6() ** 3) * 40
const imanIntensidad = () => ESTADOS[estadoActual].usaIman ? VOZ() * f5() * f5() : 0

a.setBins(4); a.setSmooth(0.85); a.setScale(8); a.setCutoff(0.1)
a.show()
const DEAD = 0.5
const limpiar = v => v < DEAD ? 0 : (v - DEAD) / (1 - DEAD)
const VOZ = () => limpiar(Math.min(1, a.fft[0]))

const iman = (px, py, fase) => shape(64, 0.2, 0.9)
  .scroll(() => px + 0.015 * Math.sin(time * 0.4 + fase), () => py + 0.015 * Math.cos(time * 0.3 + fase))
  .mult(noise(3, .3), 1)

function notaAColor(nota) {
  const hue = ((nota % 12) * 30) / 360
  const i = Math.floor(hue * 6)
  const f = hue * 6 - i
  const q = 1 - f, t = f
  switch (i % 6) {
    case 0: return [1, t, 0]
    case 1: return [q, 1, 0]
    case 2: return [0, 1, t]
    case 3: return [0, q, 1]
    case 4: return [t, 0, 1]
    case 5: return [1, 0, q]
  }
}

let colorPantallaActivo = false
let colorPantalla = [1, 1, 1]
const colorAlpha = () => colorPantallaActivo ? 1 : 0

const RAFAGA_CANTIDAD = 10
const RAFAGA_POLL = 30

const SUBDIVISIONES = [4, 2, 1]
let parteActual = 0
let contadorPulsos = 0

s1.initImage(videos[0])
GP.tools.panel().textContent = 'esperando ch16 de padKONTROL...'

let rx = 0, ry = 0, rw = 1, rh = 1
let imgScale = 1, imgX = 0, imgY = 0
let tinteR = 1, tinteG = 1, tinteB = 1
let cargando = false
let sueltaPendiente = false

let ATAQUE_ACTIVO = false
const ATAQUE_MAX = 0.6
let ataqueInicio = 0
let ataqueDur = ATAQUE_MAX
let barriendoActivo = false
let rxIni = 0, ryIni = 0
let rxFin = 0, ryFin = 0
let imgXFin = 0, imgYFin = 0

update = () => {
  f1s += (F1 / 127 - f1s) * SUAVIZADO
  f2s += (F2 / 127 - f2s) * SUAVIZADO
  f3s += (F3 / 127 - f3s) * SUAVIZADO
  f4s += (F4 / 127 - f4s) * SUAVIZADO
  f5s += (F5 / 127 - f5s) * SUAVIZADO
  f6s += (F6 / 127 - f6s) * SUAVIZADO

  if (!barriendoActivo) return
  const t = Math.min(1, (time - ataqueInicio) / ataqueDur)
  const e = 1 - Math.pow(1 - t, 3)
  rx = rxIni + (rxFin - rxIni) * e
  ry = ryIni + (ryFin - ryIni) * e
  imgX = imgXFin + (rx - rxFin)
  imgY = imgYFin + (ry - ryFin)
  if (t >= 1) barriendoActivo = false
}

const cortarBarrido = () => {
  sueltaPendiente = true
  if (!barriendoActivo) return
  rx = rxFin
  ry = ryFin
  imgX = imgXFin
  imgY = imgYFin
  barriendoActivo = false
}

const rect = () => shape(4, 1, 0.001)
  .scale(() => rw, () => rh)
  .scrollX(() => rx)
  .scrollY(() => ry)
  .modulateScrollX(noise(3, .4).pixelate(1, 120), () => f1() * .5)

const nuevoRectangulo = (nota = 60) => {
  if (cargando) return
  cargando = true
  sueltaPendiente = false

  const i = Math.floor(Math.random() * videos.length)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = videos[i]

  const timeoutId = setTimeout(() => {
    console.warn('imagen tardó demasiado en cargar, se libera el disparo:', videos[i])
    cargando = false
  }, 4000)

  const liberar = () => {
    clearTimeout(timeoutId)
    cargando = false
  }

  img.addEventListener('error', () => {
    console.warn('error al cargar la imagen, se libera el disparo:', videos[i])
    liberar()
  }, { once: true })

  img.addEventListener('load', () => {
    liberar()
    s1.src = img
    s1.dynamic = true

    const rango3 = 0.15 + f3() * 2
    rw = 0.3 + Math.random() * rango3
    rh = 0.3 + Math.random() * rango3
    rxFin = (Math.random() - 0.5) * 0.7
    ryFin = (Math.random() - 0.5) * 0.7

    const factorZoom = 1 + f3()
    const escalaBase = 0.75 + Math.random() * 0.25
    imgScale = escalaBase * factorZoom
    imgXFin = (Math.random() - 0.5) * 0.2
    imgYFin = (Math.random() - 0.5) * 0.2

    const [tR, tG, tB] = notaAColor(nota)
    tinteR = tR; tinteG = tG; tinteB = tB

    if (ATAQUE_ACTIVO && !sueltaPendiente) {
      const angulo = Math.random() * Math.PI * 2
      const distancia = 1.3
      rxIni = rxFin + Math.cos(angulo) * distancia
      ryIni = ryFin + Math.sin(angulo) * distancia
      rx = rxIni
      ry = ryIni
      ataqueInicio = time
      ataqueDur = ATAQUE_MAX
      barriendoActivo = true
    } else {
      rx = rxFin
      ry = ryFin
      imgX = imgXFin
      imgY = imgYFin
      barriendoActivo = false
    }
  }, { once: true })
}

const rafagaEstado = (nota = 60, cantidad = RAFAGA_CANTIDAD) => {
  let disparados = 0
  const intentar = () => {
    if (disparados >= cantidad) return
    if (cargando) { setTimeout(intentar, RAFAGA_POLL); return }
    nuevoRectangulo(nota)
    disparados++
    setTimeout(intentar, RAFAGA_POLL)
  }
  intentar()
}

if (window._gpCollageMidi) window._gpCollageMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpCollageMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    const esAkai = AKAI.test(inp.name), esKorg = KORG.test(inp.name)
    if (!esAkai && !esKorg) return

    const fn = m => {
      const [st, nota, vel] = m.data
      const tipo = st & 0xF0
      const on = tipo === 0x90 && vel > 0
      const off = tipo === 0x80 || (tipo === 0x90 && vel === 0)
      const canal = (st & 0x0F) + 1

      if (m.data.length > 1) GP.tools.log(inp.name, m.data)   // TEMPORAL: loguea todo menos el clock, para validar el reproductor
      GP.tools.grabador.registrar(inp.name, m.data)

      if (on && canal === 16) {
        estadoActual = (estadoActual + 1) % ESTADOS.length
        const estado = ESTADOS[estadoActual]
        colorPantallaActivo = estado.usaColorPantalla
        if (colorPantallaActivo) colorPantalla = [Math.random(), Math.random(), Math.random()]
        ATAQUE_ACTIVO = estado.usaBarrido
        parteActual = (parteActual + 1) % SUBDIVISIONES.length
        contadorPulsos = 0
        rafagaEstado(nota)
      }

      if (on && canal === 10) {
        contadorPulsos++
        if (contadorPulsos >= SUBDIVISIONES[parteActual]) {
          contadorPulsos = 0
          nuevoRectangulo(nota)
        }
      }

      if (esAkai && on && nota === 0) { ATAQUE_ACTIVO = !ATAQUE_ACTIVO; return }
      if (esAkai && nota >= 56 && nota <= 63) {
        if (on) nuevoRectangulo(nota)
        if (off) cortarBarrido()
        return
      }
      if (esKorg && !MODO_PRUEBA) {
        if (ROL.disparo.canales.includes(canal)) {
          if (on) nuevoRectangulo(nota)
          if (off) cortarBarrido()
        }
        return
      }
      if (esKorg) return
      if (esAkai && MODO_PRUEBA && nota <= 63) {
        const fila = Math.floor(nota / 8) + 1
        if (fila === 7) {
          if (on) nuevoRectangulo(nota)
          if (off) cortarBarrido()
        }
      }
    }
    inp.addEventListener('midimessage', fn)
    window._gpCollageMidi.push([inp, fn])
  })
})

src(o0)
  .layer(
    src(s1)
      .scale(
        () => imgScale * escalaExtra(),
        () => (imgScale / ((width / height) / VIDEO_ASPECT) * AJUSTE) * escalaExtra()
      )
      .scrollX(() => imgX)
      .scrollY(() => imgY)
      .pixelate(() => pixelSize(), () => pixelSize())
      .modulateScrollX(noise(3, .1).pixelate(1, 120), () => f1() * 2)
      .mult(solid(() => tinteR, () => tinteG, () => tinteB), () => f4())
      .mask(rect())
  )
  .modulate(iman(0, 0, 0), imanIntensidad)
  .out(o0)

src(o0)
  .mult(solid(() => colorPantalla[0], () => colorPantalla[1], () => colorPantalla[2]), () => colorAlpha())
  .out(o1)

render(o1)