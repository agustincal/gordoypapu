//
// G&P — BUSCANDO PLACER
// por Agustín Calviño
// Gordo y Papu
// VERSIÓN MIDI — 3 CHANNELS — CONTROLADA
//
// CH0 → ARPEGIO
// CH1 → BAJO
// CH9 → BATERÍA
//
// NOTA GRAVE → movimiento más lento
// como pasar de negras → blancas → redondas
//

await loadScript('https://cdn.jsdelivr.net/npm/hydra-midi@latest/dist/index.js')

await midi.start({
  channel: "*",
  input: "*"
})

midi.show()


// --------------------------------------------------
// VARIABLES
// --------------------------------------------------

let arpStep = 0
let bassStep = 0
let drumStep = 0

let currentColor = [1, 0, 0]

// Velocidad temporal general
let timeFactor = 1


// --------------------------------------------------
// NOTA → COLOR
// 12 notas = 12 colores claramente diferentes
// --------------------------------------------------

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


// --------------------------------------------------
// MIDI
// --------------------------------------------------

let live = midi.input(0).channel("*")


live.onNote("*", ({ note, velocity, channel }) => {


  // ----------------------------------------------
  // CH0 — ARPEGIO
  // ----------------------------------------------

  if (channel == 0) {

    arpStep = note % 12

    currentColor = noteToRGB(note)


    // --------------------------------------------
    // DURACIÓN / VELOCIDAD GENERAL
    //
    // grave → lento
    // agudo → rápido
    // --------------------------------------------

    if (note < 48) {

      timeFactor = 0.25       // REDONDA

    } else if (note < 60) {

      timeFactor = 0.5        // BLANCA

    } else if (note < 72) {

      timeFactor = 0.75       // intermedio

    } else {

      timeFactor = 1          // NEGRA

    }

  }


  // ----------------------------------------------
  // CH1 — BAJO
  // ----------------------------------------------

  if (channel == 1) {

    bassStep = note % 12

  }


  // ----------------------------------------------
  // CH9 — BATERÍA
  // ----------------------------------------------

  if (channel == 9) {

    drumStep = note % 12

  }

})


// --------------------------------------------------
// VISUAL
// --------------------------------------------------

osc(

  () => (1 + arpStep * 2) * timeFactor,

  0.9,
  300

)

.color(

  () => currentColor[0],
  () => currentColor[1],
  () => currentColor[2]

)

.diff(

  osc(

    () => (20 + arpStep * 5) * timeFactor,

    0.3,
    100

  )

  .color(0.9, 0.9, 0.9)

  .rotate(0.0)

  .pixelate(

    () => 8 + arpStep * 1.5

  )

  .kaleid(2)

)

.scrollX(10)

.colorama()

.luma()

.repeatX(1)

.repeatY(1)

.modulate(

  osc(

    () => (1 + bassStep * 0.15) * timeFactor,

    -0.9,
    300

  )

)

.scale(

  () => 2 + drumStep * 0.025

)
.scale()

.out()