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
  { dispositivo: 'akai', notas: [98], accion: 'grabadorCiclo',  led: true },
  { dispositivo: 'akai', notas: [82], accion: 'velocidadX2',    led: true },
  { dispositivo: 'akai', notas: [83], accion: 'velocidadDiv2',  led: true },
]

// DEFAULT compartido por todos los estados (todavía no varía nada de esto)
const DEFAULT = { f1: 0.5, f2: 0.8, f4: 0.8, f5: 0.5, f6: 0, usaIman: false, usaBarrido: false, ritmo: ['negra'] }

const ESTADOS = [
  { nombre: 'estado 1',  ...DEFAULT, f3: 0.1, usaColorPantalla: false },
  { nombre: 'estado 2',  ...DEFAULT, f3: 0.2, usaColorPantalla: true  },
  { nombre: 'estado 3',  ...DEFAULT, f3: 0.3, usaColorPantalla: false },
  { nombre: 'estado 4',  ...DEFAULT, f3: 0.4, usaColorPantalla: true  },
  { nombre: 'estado 5',  ...DEFAULT, f3: 0.5, usaColorPantalla: false },
  { nombre: 'estado 6',  ...DEFAULT, f3: 0.6, usaColorPantalla: true  },
  { nombre: 'estado 7',  ...DEFAULT, f3: 0.7, usaColorPantalla: false },
  { nombre: 'estado 8',  ...DEFAULT, f3: 0.8, usaColorPantalla: true  },
  { nombre: 'estado 9',  ...DEFAULT, f3: 0.9, usaColorPantalla: false },
  { nombre: 'estado 10', ...DEFAULT, f3: 1.0, usaColorPantalla: true  },
]

GP.zapping.init({
  videos,
  estados: ESTADOS,
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
  if (accion === 'cambiarEstado' && on) GP.zapping.avanzarEstado()
  if (accion === 'toggleBarrido' && on) GP.zapping.toggleBarrido()
  if (accion === 'grabadorCiclo' && on) GP.tools.grabadorCiclo()
  if (accion === 'velocidadX2' && on) GP.zapping.multiplicarVelocidad(2)
  if (accion === 'velocidadDiv2' && on) GP.zapping.multiplicarVelocidad(0.5)
}

const setLed = (nota, encendido) => {
  if (GP.midi.state && GP.midi.state.output) GP.midi.state.output.send([0x90, nota, encendido ? 4 : 1])
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

      for (const regla of RUTEO) {
        if (coincide(regla, dispositivo, canal, nota)) {
          ejecutar(regla.accion, { on, off, nota })
          if (regla.led && (on || off)) setLed(nota, on)
        }
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