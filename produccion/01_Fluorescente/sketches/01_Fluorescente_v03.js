// ============================================================
// 01_Fluorescente_v14.js
// Sketch principal de Fluorescente — v14: la pantalla se parte en dos
// mitades verticales (izquierda/derecha). La mitad izquierda siempre
// queda "normal" (igual que antes). La mitad derecha tiene DOS efectos
// nuevos, cada uno con su propio toggle en el Akai, que se pueden usar
// por separado o juntos:
//   N15 (nota 4) -> la mitad derecha queda rotada 90° extra
//   N16 (nota 5) -> la mitad derecha queda "atrasada" (ver nota abajo)
// Con los dos apagados, la derecha es idéntica a la izquierda (no se
// nota el corte). F1-F7/FMASTER y los toggles ya existentes (N11
// rotación global, N12-N14 mute por canal) siguen afectando a TODA la
// pantalla por igual, no sólo a una mitad.
//
// Cómo está armado el corte: una máscara dura (gradient().r().thresh())
// separa la pantalla en x=0.5, sin depender de ninguna forma/figura.
//
// Sobre el "delay": como este visual no se mueve por video sino por
// fase/altura/energía de las notas MIDI, no hay un buffer de píxeles
// para atrasar literalmente. En cambio, se guarda un historial corto de
// ese estado (fase del arpegio/bajo, energía, color, golpes de batería)
// y la mitad derecha, cuando este toggle está activo, lee ese historial
// en vez del valor actual — con DELAY_MITAD_MS de atraso (abajo, 200ms
// por default, ajustable). Es una aproximación: la mitad derecha repite
// con atraso lo que le pasó a las notas, no es un eco de video real.
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
const f4 = () => f4s        // modulate del bajo — en 0 es recto/sin deformación
const f5 = () => f5s        // brightness del snare — cuánto "flashea" cada golpe
const f6 = () => f6s        // scale del kick — cuánto "pulsa" cada golpe
const f7 = () => f7s        // velocidad de scroll — sólo capa principal
const fmaster = () => fms   // contraste general — realce/emergencia

// --------------------------------------------------
// LED manual — prende (rojo, valor 5) o apaga (valor 0) un pad del Akai.
// Patrón confirmado funcional en "Luz Rítmica": este Akai Mini sólo
// responde confiable a esos dos valores (otros dan parpadeo o nada).
// --------------------------------------------------
function setLed(nota, encendido) {
  const salida = GP.midi.state.output
  if (salida) salida.send([0x90, nota, encendido ? 5 : 0])
}

// --------------------------------------------------
// ROTACIÓN 90° GLOBAL — toggle discreto (instantáneo) con un pad del Akai
// --------------------------------------------------
const NOTA_ROTAR90 = 0       // pad N11 (esquina arriba-izquierda) del Akai
let rotar90 = false          // false = 0°, true = 90°

// --------------------------------------------------
// MUTE POR CANAL — toggles independientes para arpegio / bajo / batería.
// --------------------------------------------------
const NOTA_TOGGLE_ARP      = 1   // pad N12 del Akai
const NOTA_TOGGLE_BAJO     = 2   // pad N13 del Akai
const NOTA_TOGGLE_BATERIA  = 3   // pad N14 del Akai

let activoArp = true
let activoBajo = true
let activoBateria = true

// --------------------------------------------------
// MITAD DERECHA — rotación extra y/o delay, cada uno con su pad
// --------------------------------------------------
const NOTA_TOGGLE_ROTAR_MITAD = 4   // pad N15 del Akai
const NOTA_TOGGLE_DELAY_MITAD = 5   // pad N16 del Akai
const DELAY_MITAD_MS = 200          // cuánto atraso tiene la mitad derecha con el delay activo (ajustable)

let usarRotacionMitad = false
let usarDelayMitad = false

// Estado inicial de todos los LEDs
setLed(NOTA_TOGGLE_ARP, activoArp)
setLed(NOTA_TOGGLE_BAJO, activoBajo)
setLed(NOTA_TOGGLE_BATERIA, activoBateria)
setLed(NOTA_TOGGLE_ROTAR_MITAD, usarRotacionMitad)
setLed(NOTA_TOGGLE_DELAY_MITAD, usarDelayMitad)

// --------------------------------------------------
// HISTORIAL para el delay de la mitad derecha: guardamos una muestra del
// estado relevante cada frame, con su timestamp, y descartamos lo viejo.
// --------------------------------------------------
let historial = []
let histActual = {
  arpPitch: 0, arpPhase: 0, arpEnergy: 0, arpRGB: [1, 0, 0],
  bassPitch: 0, bassPhase: 0, bassEnergy: 0,
  drumKick: 0, drumSnare: 0, drumHat: 0
}

function calcularHistorico(delayMs, ahora) {
  if (historial.length === 0) return histActual
  const objetivo = ahora - delayMs
  let i = historial.findIndex(h => h.t >= objetivo)
  if (i === -1) i = historial.length - 1
  if (i <= 0) return historial[0]
  const a = historial[i - 1], b = historial[i]
  const t = (b.t - a.t) > 0 ? (objetivo - a.t) / (b.t - a.t) : 0
  const mezcla = (x, y) => x + (y - x) * t
  return {
    arpPitch: mezcla(a.arpPitch, b.arpPitch),
    arpPhase: mezcla(a.arpPhase, b.arpPhase),
    arpEnergy: mezcla(a.arpEnergy, b.arpEnergy),
    arpRGB: [mezcla(a.arpRGB[0], b.arpRGB[0]), mezcla(a.arpRGB[1], b.arpRGB[1]), mezcla(a.arpRGB[2], b.arpRGB[2])],
    bassPitch: mezcla(a.bassPitch, b.bassPitch),
    bassPhase: mezcla(a.bassPhase, b.bassPhase),
    bassEnergy: mezcla(a.bassEnergy, b.bassEnergy),
    drumKick: mezcla(a.drumKick, b.drumKick),
    drumSnare: mezcla(a.drumSnare, b.drumSnare),
    drumHat: mezcla(a.drumHat, b.drumHat)
  }
}

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

  const ahora = performance.now()
  historial.push({
    t: ahora,
    arpPitch: S.arp.pitch, arpPhase: S.arp.phase, arpEnergy: S.arp.energy,
    arpRGB: [S.arpRGB[0], S.arpRGB[1], S.arpRGB[2]],
    bassPitch: S.bass.pitch, bassPhase: S.bass.phase, bassEnergy: S.bass.energy,
    drumKick: S.drum.kick, drumSnare: S.drum.snare, drumHat: S.drum.hat
  })
  while (historial.length > 1 && ahora - historial[0].t > DELAY_MITAD_MS + 500) historial.shift()
  histActual = calcularHistorico(DELAY_MITAD_MS, ahora)
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
        // Pad de rotación 90° global: toggle, no va al motor de zapping
        if (nota === NOTA_ROTAR90) {
          rotar90 = !rotar90
          return
        }

        // Pads de mute por canal
        if (nota === NOTA_TOGGLE_ARP) {
          activoArp = !activoArp
          setLed(NOTA_TOGGLE_ARP, activoArp)
          return
        }
        if (nota === NOTA_TOGGLE_BAJO) {
          activoBajo = !activoBajo
          setLed(NOTA_TOGGLE_BAJO, activoBajo)
          return
        }
        if (nota === NOTA_TOGGLE_BATERIA) {
          activoBateria = !activoBateria
          setLed(NOTA_TOGGLE_BATERIA, activoBateria)
          return
        }

        // Pads de la mitad derecha (rotación extra / delay)
        if (nota === NOTA_TOGGLE_ROTAR_MITAD) {
          usarRotacionMitad = !usarRotacionMitad
          setLed(NOTA_TOGGLE_ROTAR_MITAD, usarRotacionMitad)
          return
        }
        if (nota === NOTA_TOGGLE_DELAY_MITAD) {
          usarDelayMitad = !usarDelayMitad
          setLed(NOTA_TOGGLE_DELAY_MITAD, usarDelayMitad)
          return
        }

        // Si el canal de esta nota está muteado, no la mandamos al motor
        if (canal === 0 && !activoArp) return
        if (canal === 1 && !activoBajo) return
        if (canal === 9 && !activoBateria) return

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

// "estado" agrupa lo que depende de las notas MIDI (lo que puede diferir
// entre la mitad izquierda y la derecha). Cada campo es una función para
// que se vuelva a leer en cada frame, no un valor congelado al armar la
// cadena de Hydra.
const estadoIzquierda = {
  arpPitch:  () => S.arp.pitch,
  arpPhase:  () => S.arp.phase,
  arpEnergy: () => S.arp.energy,
  arpRGB:    () => S.arpRGB,
  bassPitch: () => S.bass.pitch,
  bassPhase: () => S.bass.phase,
  bassEnergy:() => S.bass.energy,
  drumKick:  () => S.drum.kick,
  drumSnare: () => S.drum.snare,
  drumHat:   () => S.drum.hat
}

// La derecha lee lo mismo que la izquierda, EXCEPTO si usarDelayMitad
// está activo, en cuyo caso lee del historial (histActual, recalculado
// cada frame en update()) en vez del valor en vivo.
const estadoDerecha = {
  arpPitch:  () => usarDelayMitad ? histActual.arpPitch  : S.arp.pitch,
  arpPhase:  () => usarDelayMitad ? histActual.arpPhase  : S.arp.phase,
  arpEnergy: () => usarDelayMitad ? histActual.arpEnergy : S.arp.energy,
  arpRGB:    () => usarDelayMitad ? histActual.arpRGB    : S.arpRGB,
  bassPitch: () => usarDelayMitad ? histActual.bassPitch : S.bass.pitch,
  bassPhase: () => usarDelayMitad ? histActual.bassPhase : S.bass.phase,
  bassEnergy:() => usarDelayMitad ? histActual.bassEnergy: S.bass.energy,
  drumKick:  () => usarDelayMitad ? histActual.drumKick  : S.drum.kick,
  drumSnare: () => usarDelayMitad ? histActual.drumSnare : S.drum.snare,
  drumHat:   () => usarDelayMitad ? histActual.drumHat   : S.drum.hat
}

// Construye la cadena de una mitad (todo lo que depende de arp/bass/
// batería), terminando en una rotación extra opcional. Los faders
// F1-F7 son globales: se usan igual en las dos mitades.
function construirMitad(estado, anguloExtra) {
  return osc(() => 3 + estado.arpPitch() * 30, 0, 0)
    .scrollX(() => estado.arpPhase() * (0.2 + f7() * 0.8))
    .color(() => estado.arpRGB()[0], () => estado.arpRGB()[1], () => estado.arpRGB()[2])

    .diff(
      osc(() => 20 + estado.arpPitch() * 40, 0, 0)
        .scrollX(() => -estado.arpPhase() * 0.1)
        .pixelate(() => 8 + estado.arpEnergy() * 16 + estado.drumHat() * 20 + f1() * 40)
        .kaleid(() => 2 + f2() * 6)
    )

    .colorama(() => 0.005 + f3() * 0.3)
    .luma()

    .modulate(
      osc(() => 2 + estado.bassPitch() * 6, 0, 0)
        .scrollY(() => estado.bassPhase() * 0.1),
      () => f4() * (0.5 + estado.bassEnergy() * 0.4)
    )

    .brightness(() => estado.drumSnare() * (0.3 + f5() * 0.7))
    .scale(() => 1.5 + estado.drumKick() * (0.3 + f6() * 0.7))
    .rotate(anguloExtra)
}

// Máscaras duras que parten la pantalla en x=0.5 (gradient().r() = la
// coordenada x pura; thresh la vuelve un corte binario sin degradé).
// Se definen como funciones para construir una cadena nueva cada vez que
// se usan (reusar la misma cadena de Hydra en dos ramas rompe el shader).
function mascaraDerecha() { return gradient(0).r().thresh(0.5, 0.005) }
function mascaraIzquierda() { return gradient(0).r().thresh(0.5, 0.005).invert(1) }

construirMitad(estadoIzquierda, () => 0)
  .mask(mascaraIzquierda())

  .add(
    construirMitad(estadoDerecha, () => usarRotacionMitad ? Math.PI / 2 : 0)
      .mask(mascaraDerecha()),
    1
  )

  // FMASTER: en 0, contrast(1) = sin cambio. Global, afecta las dos mitades.
  .contrast(() => 1 + fmaster() * 2)

  // Rotación 90° global (N11). También afecta a toda la pantalla, no sólo a una mitad.
  .rotate(() => rotar90 ? Math.PI / 2 : 0)

  .out()