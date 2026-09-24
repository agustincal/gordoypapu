// ============================================================
// zappingVideos-MidiCtrl — collage de video con control MIDI
// ============================================================

// ---- setup base MIDI (Akai) ----
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-midi-base-AkaiMini-v0.9.js')
await GP.midi.start()
GP.midi.buttons(['N11'])                        // N11 = toggle del "ataque" de entrada
GP.midi.faders(['F1', 'F2', 'F3', 'F5', 'F6'])  // controles activos, se iluminan en el Akai

// ---- assets de video ----
const BASE_VIDEOS = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/assets/videos01/'
const videos = Array.from({ length: 61 }, (_, n) => {
  const num = String(n + 1).padStart(2, '0')
  return `${BASE_VIDEOS}Kim_chi_fied_rice_${num}.mp4`
})
const VIDEO_ASPECT = 720 / 1280   // videos verticales, para corregir el estiramiento
const AJUSTE = 1                  // perilla manual de corrección de aspecto

// ---- routing MIDI: qué dispositivo dispara y en qué modo ----
const AKAI = /apc|akai/i
const KORG = /korg|padkontrol/i
const MODO_PRUEBA = false                        // true = disparar con fila 7 del Akai (sin Korg a mano)
const ROL = { disparo: { canal: 1, nota: 60 } }  // Korg: canal 1, cualquier nota

// ---- faders normalizados a 0..1 ----
const f1 = () => F1 / 127   // jitter
const f2 = () => F2 / 127   // pixelado
const f3 = () => F3 / 127   // tamaño de rectángulo / zoom interno
const f5 = () => F5 / 127   // intensidad del imán de voz
const f6 = () => F6 / 127   // escala extra del video interno (0 = look normal)

const pixelSize = () => 600 - (f2() ** 3) * 595   // curva cúbica: efecto se nota recién arriba del fader

// en 0 no toca nada; subiendo el fader agranda mucho la escala (hasta x41),
// llevando al acercamiento extremo, "ver pixeles solamente"
const escalaExtra = () => 1 + (f6() ** 3) * 40

// ---- audio: voz por micrófono, con zona muerta ----
a.setBins(4); a.setSmooth(0.85); a.setScale(8); a.setCutoff(0.1)
a.show()
const DEAD = 0.5   // sólo reacciona a partir de la mitad de la escala de audio
const limpiar = v => v < DEAD ? 0 : (v - DEAD) / (1 - DEAD)
const VOZ = () => limpiar(Math.min(1, a.fft[0]))

// forma usada como "imán" de distorsión sobre el compuesto final
const iman = (px, py, fase) => shape(64, 0.2, 0.9)
  .scroll(() => px + 0.015 * Math.sin(time * 0.4 + fase), () => py + 0.015 * Math.cos(time * 0.3 + fase))
  .mult(noise(3, .3), 1)

// ============================================================
// ESTADO DEL RECTÁNGULO ACTUAL
// ============================================================

s1.initVideo(videos[0])

let rx = 0, ry = 0, rw = 1, rh = 1        // posición y tamaño del rectángulo
let imgScale = 1, imgX = 0, imgY = 0      // zoom y offset del video dentro del rectángulo
let cargando = false                       // evita solapar cargas de video

// ---- barrido de entrada (ataque), cortado al soltar la nota ----
let ATAQUE_ACTIVO = false   // apagado por defecto, toggle con N11 (nota 0 del Akai)
const ATAQUE_MAX = 0.6      // tope: nota sostenida esto o más = barrido completo
let ataqueInicio = 0
let ataqueDur = ATAQUE_MAX
let barriendoActivo = false
let rxIni = 0, ryIni = 0
let rxFin = 0, ryFin = 0
let imgXFin = 0, imgYFin = 0

// avanza el barrido mientras está activo; llega solo a destino y se detiene
update = () => {
  if (!barriendoActivo) return
  const t = Math.min(1, (time - ataqueInicio) / ataqueDur)
  const e = 1 - Math.pow(1 - t, 3)
  rx = rxIni + (rxFin - rxIni) * e
  ry = ryIni + (ryFin - ryIni) * e
  imgX = imgXFin + (rx - rxFin)
  imgY = imgYFin + (ry - ryFin)
  if (t >= 1) barriendoActivo = false
}

// corta el barrido al instante (se llama en el note-off)
const cortarBarrido = () => {
  if (!barriendoActivo) return
  rx = rxFin
  ry = ryFin
  imgX = imgXFin
  imgY = imgYFin
  barriendoActivo = false
}

// máscara del rectángulo, con jitter propio
const rect = () => shape(4, 1, 0.001)
  .scale(() => rw, () => rh)
  .scrollX(() => rx)
  .scrollY(() => ry)
  .modulateScrollX(noise(3, .4).pixelate(1, 120), () => f1() * .5)

// ============================================================
// DISPARO DE UN RECTÁNGULO NUEVO
// ============================================================

const nuevoRectangulo = () => {
  if (cargando) return
  cargando = true

  const i = Math.floor(Math.random() * videos.length)
  const v = document.createElement('video')
  v.crossOrigin = 'anonymous'
  v.loop = true
  v.muted = true
  v.playsInline = true
  v.src = videos[i]

  v.addEventListener('playing', () => {
    // swap del source: recién acá, cuando el video ya tiene un frame real
    const anterior = s1.src
    s1.src = v
    s1.dynamic = true
    if (anterior) {
      anterior.pause()
      anterior.removeAttribute('src')
      anterior.load()
    }

    // tamaño del rectángulo y zoom interno, coordinados por F3
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

    // arranca el barrido de entrada, si está activo
    if (ATAQUE_ACTIVO) {
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

    cargando = false
  }, { once: true })

  v.load()
  v.play().catch(() => {})
}

// ============================================================
// MIDI: disparo real (Korg) + modo de prueba (Akai)
// ============================================================

if (window._gpCollageMidi) window._gpCollageMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpCollageMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    console.log('MIDI in:', inp.name)
    const esAkai = AKAI.test(inp.name), esKorg = KORG.test(inp.name)
    if (!esAkai && !esKorg) return

    const fn = m => {
      const [st, nota, vel] = m.data
      const tipo = st & 0xF0
      const on = tipo === 0x90 && vel > 0
      const off = tipo === 0x80 || (tipo === 0x90 && vel === 0)
      const canal = (st & 0x0F) + 1

      // Akai nota 0 (N11): toggle del ataque de entrada
      if (esAkai && on && nota === 0) {
        ATAQUE_ACTIVO = !ATAQUE_ACTIVO
        console.log('ataque de entrada:', ATAQUE_ACTIVO ? 'ACTIVADO' : 'DESACTIVADO')
        return
      }

      // Korg (producción): canal de disparo dispara y corta el barrido
      if (esKorg && !MODO_PRUEBA) {
        if (canal === ROL.disparo.canal) {
          if (on) nuevoRectangulo()
          if (off) cortarBarrido()
        }
        return
      }
      if (esKorg) return

      // Akai en modo prueba: fila 7 simula el disparo del Korg
      if (esAkai && MODO_PRUEBA && nota <= 63) {
        const fila = Math.floor(nota / 8) + 1
        if (fila === 7) {
          if (on) nuevoRectangulo()
          if (off) cortarBarrido()
        }
      }
    }
    inp.addEventListener('midimessage', fn)
    window._gpCollageMidi.push([inp, fn])
  })
})

// ============================================================
// RENDER
// ============================================================

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
      .mask(rect())
  )
  .modulate(iman(0, 0, 0), () => VOZ() * f5() * f5())
  .out()