// ============================================================
// 02_Buscando_Placer_v01
// Canción 02 · Buscando Placer (Gordo y Papu) — sketch de producción
// Config de esta versión: estados, ruteo MIDI, assets. El motor vive en /arquitectura
// Actualizado: 2026-09-27
// ============================================================

const GP_SHA = 'dd24e11dfc57a4e04448afcde6d648e50c36622a'

await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/02_Buscando_Placer/arquitectura/GP_02_Buscando_Placer__loader.js`)
await GP_cargarModulosBuscandoPlacer(GP_SHA)

await GP.midi.start({ outputName: 'APC MINI' })
GP.midi.buttons(['N11', 'N81', 'N82', 'N83', 'N84', 'N85', 'N86', 'N87', 'N88'])
GP.midi.faders(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'])

const MODO_FUENTE = 'video'   // 'imagen' | 'video' — cambiá esto para probar

const BASE_IMAGENES = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/produccion/02_Buscando_Placer/assets/sequence01/'
const BASE_VIDEOS   = 'https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/produccion/02_Buscando_Placer/assets/videos01/'

const archivosImagen = ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg'].map(n => BASE_IMAGENES + n)

const DESDE = 1
const HASTA = 7
const archivosVideo = Array.from({ length: HASTA - DESDE + 1 }, (_, i) =>
  BASE_VIDEOS + `Kim_chi_fied_rice_${String(DESDE + i).padStart(2, '0')}.mp4`
)

const videos = MODO_FUENTE === 'video' ? archivosVideo : archivosImagen
const VIDEO_ASPECT = MODO_FUENTE === 'video' ? (720 / 1280) : 1
const AJUSTE = 1

const AKAI = /apc|akai/i
const KORG = /korg|padkontrol/i
const MODO_PRUEBA = false

const RUTEO = [
  { dispositivo: 'korg', canales: [2, 3], accion: 'disparar' },
  { dispositivo: 'korg', canales: [16],   accion: 'cambiarEstado' },
  { dispositivo: 'akai', notas: [56, 57, 58, 59, 60, 61, 62, 63], accion: 'disparar' },
  { dispositivo: 'akai', notas: [0],  accion: 'toggleBarrido' },
  { dispositivo: 'akai', notas: [98], accion: 'grabadorCiclo',  led: true },
]

// orden de columnas: nombre, f1, f2, f3, f4, f5, f6, f7, f8, usaIman, usaBarrido, colorBase, ritmo, resolucion
const CAMPOS = ['nombre', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'usaIman', 'usaBarrido', 'colorBase', 'ritmo', 'resolucion', 'siguenRitmo']

const TABLA = [
  ['estado 1',  0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.10, 0.00, true,  false,  0.00, '...X.X.X.X...X.X',    'semicorchea', true],
  ['estado 2',  0.00, 0.05, 0.28, 0.00, 0.00, 0.90, 0.00, 0.00, false, false, 0.08, 'X...',                'semicorchea', true],
  ['estado 3',  0.00, 0.05, 0.36, 0.00, 0.00, 0.08, 0.00, 0.00, false, false, 0.15, '.X.....X.X...X.X',    'semicorchea', false],
  ['estado 4',  0.00, 0.05, 0.36, 0.00, 0.00, 0.08, 0.00, 0.00, false, false, 0.15, '.X..',                'semicorchea', false],
  ['estado 5',  0.60, 0.10, 0.55, 0.40, 0.30, 0.65, 0.00, 0.00, true,  true,  0.40, '.....X.X.XXX.X..',    'semicorchea', false],
  ['estado 6',  0.10, 0.05, 0.45, 0.15, 0.10, 0.10, 0.00, 0.00, true,  false, 0.45, '.X.X.X.X.X...X.X',    'semicorchea', false],
  ['estado 7',  0.35, 0.10, 0.60, 0.35, 0.35, 0.15, 0.00, 0.00, true,  true,  0.52, '.....X.X.XXX.X.X',    'semicorchea', false],
  ['estado 8',  0.75, 0.75, 0.65, 0.45, 0.45, 0.70, 0.00, 0.00, true,  true,  0.60, '...X.X.X.X...X.X',    'semicorchea', false],
  ['estado 9',  0.10, 0.05, 0.35, 0.15, 0.10, 0.10, 0.00, 0.00, true,  false, 0.68, '...X.X.X.X.X.X.X',    'semicorchea', false],
  ['estado 10', 0.00, 0.05, 0.20, 0.05, 0.00, 0.05, 0.00, 0.00, false, false, 0.75, '..X..X.......X.X',    'semicorchea', false],
  ['estado 11', 0.45, 0.10, 0.55, 0.35, 0.40, 0.15, 0.00, 0.00, true,  true,  0.83, '.X.X.....X...X.X',    'semicorchea', false],
  ['estado 12', 1.00, 0.75, 1.00, 0.85, 1.00, 0.80, 0.00, 0.00, true,  true,  0.90, '.....X...X.X.X..',    'semicorchea', false],
  ['estado 13', 0.20, 0.05, 0.50, 0.30, 0.20, 0.10, 0.00, 0.00, true,  false, 0.97, 'X...',                'corchea', false],
]

const ESTADOS = TABLA.map(fila => Object.fromEntries(CAMPOS.map((campo, i) => [campo, fila[i]])))

GP.zapping.init({
  videos,
  modo: MODO_FUENTE,
  estados: ESTADOS,
  rafagaCantidad: 3,
  rafagaPoll: 30,
  fuente: s1,
})

a.setBins(4); a.setSmooth(0.85); a.setScale(8); a.setCutoff(0.1)
a.show()
const DEAD = 0.5
const limpiar = v => v < DEAD ? 0 : (v - DEAD) / (1 - DEAD)
const VOZ = () => limpiar(Math.min(1, a.fft[0]))

if (MODO_FUENTE === 'video') { s1.initVideo(videos[0]) } else { s1.initImage(videos[0]) }
GP.tools.panel().textContent = 'esperando MIDI...'

update = () => GP.zapping.update()

const coincide = (regla, dispositivo, canal, nota) => {
  if (regla.dispositivo !== dispositivo) return false
  if (regla.canales && !regla.canales.includes(canal)) return false
  if (regla.notas && !regla.notas.includes(nota)) return false
  return true
}

const ejecutar = (accion, { on, off, nota }) => {
  if (accion === 'disparar') { if (on) GP.zapping.disparar(nota); if (off) GP.zapping.cortarBarrido() }
  if (accion === 'cambiarEstado' && on) {
    const idx = GP.zapping.avanzarEstado()
    if (GP.ensayo.overlayEstado) GP.ensayo.overlayEstado.mostrar(idx)
  }
  if (accion === 'toggleBarrido' && on) GP.zapping.toggleBarrido()
  if (accion === 'grabadorCiclo' && on) GP.tools.grabadorCiclo()
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

      if (st === 0xF8) { GP.zapping.pulso(); return }

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
  .layer(GP.zapping.lineaF7())
  .modulateScrollX(GP.zapping.texturaF7(), GP.zapping.intensidadF7)
  .scroll(GP.zapping.scrollXF7, 0, GP.zapping.scrollVelocidadF7)
  .out(o1)

render(o1)