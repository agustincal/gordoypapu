// ============================================================
// 01_Fluorescente_v09.js
// Sketch principal de Fluorescente — v09: el suavizado de F1 del v08
// (0.02) quedó demasiado suave/lento. Se sube a un punto intermedio
// entre eso y el suavizado normal (0.15) del resto de los faders.
// ============================================================

const GP_SHA = '6cc0f46c2a7b0c5e02b42575ffc91e9a5c6d4620' // Reemplazá con tu SHA de GitHub

await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/01_Fluorescente/arquitectura/GP_01_Fluorescente__loader.js`)

// Llamada anclada a window para evitar el error de "not defined" en Hydra
await window.GP_cargarModulosFluorescente(GP_SHA)

// Usamos tu propio módulo MIDI (GP.midi) en lugar de la librería genérica "midi"
await GP.midi.start({ outputName: 'APC MINI' }) // Podés dejar 'APC MINI' o '' según uses

// --------------------------------------------------
// FADERS — declarados para que la base les asigne LED/valor
// --------------------------------------------------
GP.midi.faders(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'FMASTER'])

// Referenciamos el estado expuesto por el motor visual de Fluorescente
const S = GP.zapping.state

// --------------------------------------------------
// FADERS — suavizado por promedio móvil (mismo patrón que Buscando Placer:
// los faders físicos entregan ruido/valores no exactos, así que se
// promedia en vez de leerlos crudos cada frame)
// --------------------------------------------------

let f1s = 0, f2s = 0, f3s = 0, f4s = 0, f5s = 0, f6s = 0, f7s = 0, fms = 0
const SUAVIZADO = 0.15
const SUAVIZADO_F1 = 0.06   // más lento que el resto, pero no tanto como el 0.02 del v08

const f1 = () => f1s        // pixelado/textura — piso extra de pixelate
const f2 = () => f2s        // kaleid — simetría extra
const f3 = () => f3s        // colorama — cuánto viaja el color (efecto fuerte, subir con cuidado)
const f4 = () => f4s        // modulate del bajo — deformación extra constante
const f5 = () => f5s        // brightness del snare — cuánto "flashea" cada golpe
const f6 = () => f6s        // scale del kick — cuánto "pulsa" cada golpe
const f7 = () => f7s        // velocidad de scroll — sólo capa principal
const fmaster = () => fms   // contraste general — realce/emergencia

// Bucle de actualización de tiempo y decaimientos (fases, energía, etc.)
update = (dt) => {
  GP.zapping.update(dt)

  f1s += (F1 / 127 - f1s) * SUAVIZADO_F1
  f2s += (F2 / 127 - f2s) * SUAVIZADO
  f3s += (F3 / 127 - f3s) * SUAVIZADO
  f4s += (F4 / 127 - f4s) * SUAVIZADO
  f5s += (F5 / 127 - f5s) * SUAVIZADO
  f6s += (F6 / 127 - f6s) * SUAVIZADO
  f7s += (F7 / 127 - f7s) * SUAVIZADO
  fms += (FMASTER / 127 - fms) * SUAVIZADO
}

// Escuchamos las notas MIDI entrantes usando la API nativa y las derivamos al motor
if (window._gpFluorescenteMidi) window._gpFluorescenteMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._gpFluorescenteMidi = []

navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    const fn = m => {
      const [st, nota, vel] = m.data

      // Opcional: logueamos el evento en tu panel de tools
      if (GP.tools && GP.tools.log) {
        GP.tools.log('MIDI', [nota, vel, st & 0x0F])
      }

      const tipo = st & 0xF0
      const on = tipo === 0x90 && vel > 0
      const canal = (st & 0x0F)

      if (on) {
        // Procesamos la nota en el motor visual (ataques, colores, batería)
        GP.zapping.onNote({ note: nota, velocity: vel, channel: canal })
      }
    }
    inp.addEventListener('midimessage', fn)
    window._gpFluorescenteMidi.push([inp, fn])
  })
})

// ============================================================
// PIPELINE VISUAL DE FLUORESCENTE
// ============================================================

osc(() => 3 + S.arp.pitch * 30, 0, 0)
  // F7: en 0, sigue siendo fase*0.2 (igual que el v02). Sube/baja sólo esta capa.
  .scrollX(() => S.arp.phase * (0.2 + f7() * 0.8))
  .color(() => S.arpRGB[0], () => S.arpRGB[1], () => S.arpRGB[2])

  .diff(
    osc(() => 20 + S.arp.pitch * 40, 0, 0)
      .scrollX(() => -S.arp.phase * 0.1)
      // F1: piso extra de pixelado, encima de lo que ya suma energía/hat
      .pixelate(() => 8 + S.arp.energy * 16 + S.drum.hat * 20 + f1() * 40)
      // F2: en 0 sigue siendo kaleid(2) como el v01
      .kaleid(() => 2 + f2() * 6)
  )

  // F3: en 0 sigue siendo colorama(0.005) como el v01
  .colorama(() => 0.005 + f3() * 0.3)
  .luma()

  .modulate(
    osc(() => 2 + S.bass.pitch * 6, 0, 0)
      .scrollY(() => S.bass.phase * 0.1),
    // F4: en 0 es la misma fórmula del v01; subiendo el fader se suma
    // deformación constante encima de lo que ya aporta la energía del bajo
    () => 0.05 + S.bass.energy * 0.4 + f4() * 0.5
  )

  // F5: en 0, multiplicador = 0.3 igual que el v01 (snare*0.3)
  .brightness(() => S.drum.snare * (0.3 + f5() * 0.7))
  // F6: en 0, multiplicador = 0.3 igual que el v01 (base 1.5 + kick*0.3)
  .scale(() => 1.5 + S.drum.kick * (0.3 + f6() * 0.7))

  // FMASTER: en 0, contrast(1) = sin cambio (idéntico al v01, que no tenía este nodo)
  .contrast(() => 1 + fmaster() * 2)

  .out()