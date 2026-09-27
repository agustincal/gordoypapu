// ============================================================
// 02_Buscando_Placer_v01
// Canción 02 · Buscando Placer (Gordo y Papu) — sketch de producción
// Config de esta versión: estados, ruteo MIDI, assets. El motor vive en /arquitectura
// Actualizado: 2026-09-27
// ============================================================

// después de cada push: pegá acá el SHA del commit (git log -1 --format=%h) y listo, sin purgar ni esperar
const GP_SHA = '1b052eca146f802753081a373a59de92c684b15e'  // ej: 'a1b2c3d' — 'main' solo mientras estás iterando en caliente

await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/02_Buscando_Placer/arquitectura/GP_02_Buscando_Placer__loader.js`)
await GP_cargarModulosBuscandoPlacer(GP_SHA)

await GP.midi.start({ outputName: 'APC MINI' })
GP.midi.buttons(['N11', 'N81', 'N82', 'N83', 'N84', 'N85', 'N86', 'N87', 'N88'])
GP.midi.faders(['F1', 'F2', 'F3', 'F4', 'F5', 'F6'])

// ---------- CONFIG (lo único que tocás para ajustar) ----------

const BASE_IMAGENES = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/produccion/02_Buscando_Placer/assets/sequence01/'
const videos = ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg'].map(n => BASE_IMAGENES + n)
const VIDEO_ASPECT = 1
const AJUSTE = 1

const AKAI = /apc|akai/i
const KORG = /korg|padkontrol/i
const MODO_PRUEBA = false

// Qué dispara qué — un solo lugar para editar rutas MIDI
const RUTEO = [
  { dispositivo: 'korg', canales: [2, 3], accion: 'disparar' },
  { dispositivo: 'korg', canales: [16],   accion: 'cambiarEstado' },
  { dispositivo: 'akai', notas: [56, 57, 58, 59, 60, 61, 62, 63], accion: 'disparar' },
  { dispositivo: 'akai', notas: [0],  accion: 'toggleBarrido' },
  { dispositivo: 'akai', notas: [84], accion: 'grabadorCiclo' },
]

// TODO: reemplazar por la lista curada — estos valores son placeholder del refactor
const ESTADOS = [
  { nombre: 'estado 1',  f1: 0.1, f2: 0.2, f3: 0.3, f4: 0.5, f5: 0.4, f6: 0.1, usaIman: false, usaColorPantalla: true,  usaBarrido: true  },
  { nombre: 'estado 2',  f1: 0.3, f2: 0.5, f3: 0.6, f4: 0.7, f5: 0.5, f6: 0.2, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
  { nombre: 'estado 3',  f1: 0.6, f2: 0.1, f3: 0.4, f4: 0.3, f5: 0.7, f6: 0.4, usaIman: false, usaColorPantalla: false, usaBarrido: true  },
  { nombre: 'estado 4',  f1: 0.2, f2: 0.8, f3: 0.2, f4: 0.9, f5: 0.3, f6: 0.6, usaIman: true,  usaColorPantalla: true,  usaBarrido: false },
  { nombre: 'estado 5',  f1: 0.7, f2: 0.4, f3: 0.8, f4: 0.5, f5: 0.6, f6: 0.3, usaIman: false, usaColorPantalla: true,  usaBarrido: true  },
  { nombre: 'estado 6',  f1: 0.4, f2: 0.6, f3: 0.5, f4: 0.4, f5: 0.8, f6: 0.5, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
  { nombre: 'estado 7',  f1: 0.9, f2: 0.3, f3: 0.7, f4: 0.6, f5: 0.2, f6: 0.7, usaIman: false, usaColorPantalla: false, usaBarrido: true  },
  { nombre: 'estado 8',  f1: 0.5, f2: 0.9, f3: 0.3, f4: 0.8, f5: 0.5, f6: 0.9, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
  { nombre: 'estado 9',  f1: 0.3, f2: 0.2, f3: 0.9, f4: 0.2, f5: 0.9, f6: 0.4, usaIman: true,  usaColorPantalla: true,  usaBarrido: true  },
  { nombre: 'estado 10', f1: 0.8, f2: 0.7, f3: 0.6, f4: 1.0, f5: 0.7, f6: 1.0, usaIman: false, usaColorPantalla: true,  usaBarrido: false },
]

GP.zapping.init({
  videos,
  estados: ESTADOS,
  subdivisiones: [24, 12, 6],  // negra, corchea, semicorchea — mismo progreso 4:2:1 de antes, ahora en pulsos reales
  rafagaCantidad: 3,
  rafagaPoll: 30,
  fuente: s1,
})

// ---------- audio reactivo (voz) ----------
a.setBins(4); a.setSmooth(0.85); a.setScale(8); a.setCutoff(0.1)
a.show()
const DEAD = 0.5
const limpiar = v => v < DEAD ? 0 : (v - DEAD) / (1 - DEAD)
const VOZ = () => limpiar(Math.min(1, a.fft[0]))

s1.initImage(videos[0])
GP.tools.panel().textContent = 'esperando MIDI...'

update = () => GP.zapping.update()

// ---------- ruteo MIDI ----------
const coincide = (regla, dispositivo, canal, nota) => {
  if (regla.dispositivo !== dispositivo) return false
  if (regla.canales && !regla.canales.includes(canal)) return false
  if (regla.notas && !regla.notas.includes(nota)) return false
  return true
}

const ejecutar = (accion, { on, off, nota }) => {
  if (accion === 'disparar') { if (on) GP.zapping.disparar(nota); if (off) GP.zapping.cortarBarrido() }
  if (accion === 'pulso' && on) GP.zapping.pulso()
  if (accion === 'cambiarEstado' && on) GP.zapping.avanzarEstado()
  if (accion === 'toggleBarrido' && on) GP.zapping.toggleBarrido()
  if (accion === 'grabadorCiclo' && on) GP.tools.grabadorCiclo()
}

if (window._gpCollageMidi) window._gpCollageMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpCollageMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    const esAkai = AKAI.test(inp.name), esKorg = KORG.test(inp.name)
    if (!esAkai && !esKorg) return
    const dispositivo = esAkai ? 'akai' : 'korg'

    const fn = m => {
  const [st, nota, vel] = m.data
  GP.tools.grabador.registrar(inp.name, m.data)

  if (st === 0xF8) { GP.zapping.pulso(); return }  // clock real del padKONTROL → ritmo por BPM

  const tipo = st & 0xF0
  const on = tipo === 0x90 && vel > 0
  const off = tipo === 0x80 || (tipo === 0x90 && vel === 0)
  const canal = (st & 0x0F) + 1

  GP.tools.log(inp.name, m.data)

  const dispositivo = esAkai ? 'akai' : 'korg'
  for (const regla of RUTEO) {
    if (coincide(regla, dispositivo, canal, nota)) ejecutar(regla.accion, { on, off, nota })
  }
}
    inp.addEventListener('midimessage', fn)
    window._gpCollageMidi.push([inp, fn])
  })
})

// ---------- render ----------
src(o0)
  .layer(
    src(s1)
      .scale(
        () => GP.zapping.rect.imgScale * GP.zapping.escalaExtra(),
        () => (GP.zapping.rect.imgScale / ((width / height) / VIDEO_ASPECT) * AJUSTE) * GP.zapping.escalaExtra()
      )
      .scrollX(() => GP.zapping.rect.imgX)
      .scrollY(() => GP.zapping.rect.imgY)
      .pixelate(() => GP.zapping.pixelSize(), () => GP.zapping.pixelSize())
      .modulateScrollX(noise(3, .1).pixelate(1, 120), () => GP.zapping.f.f1() * 2)
      .mult(solid(() => GP.zapping.rect.tinteR, () => GP.zapping.rect.tinteG, () => GP.zapping.rect.tinteB), () => GP.zapping.f.f4())
      .mask(GP.zapping.rectShape())
  )
  .modulate(GP.zapping.iman(0, 0, 0), () => GP.zapping.imanIntensidad(VOZ()))
  .out(o0)

src(o0)
  .mult(solid(() => GP.zapping.colorPantalla()[0], () => GP.zapping.colorPantalla()[1], () => GP.zapping.colorPantalla()[2]), GP.zapping.colorAlpha)
  .out(o1)

render(o1)