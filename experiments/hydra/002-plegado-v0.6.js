// G&P — PLEGADO
// by Agustín Calviño
// Gordo y Papu
// VERSIÓN 06 — etapas superpuestas
//
// CONFIGURACIÓN
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@f7d5a93fab386560b1d82381276252af0066c279/architecture/gp/gp-base-v0.4.js')
await GP.init({song:'vociferan', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5'])
GP.midi.buttons(['N11','N12','N82'])
//
// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()
//
// REACTIVO: bass.low() / drums.mid() | F1 / F2 / F3 / F4 / F5 | N11 / N12 / N82


// ======================================================
// SKETCH — escalera superpuesta
// ======================================================

// Estas dos funciones toman la información del audio que vamos a usar.
// r1 representa la energía de los graves y r2 la energía de los medios de la batería.
let r1 = () => bass.low()
let r2 = () => drums.mid()

// Movimiento horizontal lento de toda la estructura.
// F5 aumenta el recorrido y los graves aportan una pequeña variación adicional.
let driftX = () =>
  Math.sin(time * 0.10) * (0.10 + F5 * 0.18 + r2() * 0.04)

// Movimiento vertical lento de toda la estructura.
// F5 vuelve a controlar cuánto puede desplazarse y los graves agregan movimiento.
let driftY = () =>
  Math.cos(time * 0.075) * (0.08 + F5 * 0.14 + r1() * 0.04)

// Respiración de la forma.
// La velocidad es temporal y la amplitud aumenta con los graves y con F3.
let breathe = () =>
  1 + Math.sin(time * 0.31) * (0.04 + r1() * ((F3 * 100) + 1))

// Oscilación de la inclinación.
// F2 amplía el movimiento y la batería lo modifica según su actividad.
let angle = () =>
  Math.sin(time * 0.21) * (0.06 + F2 + r2() * 0.08)

// Cantidad de repeticiones verticales.
// F4 aumenta la densidad y la batería puede agregar algunas repeticiones más.
let density = () =>
  5 + F4 * 30 + r2() * 8

// ------------------------------------------------------
// CONSTRUCCIÓN DE UNA ESCALERA
// ------------------------------------------------------

// Esta función construye una escalera completa de manera independiente.
// Recibe una posición y una rotación para poder crear copias muy cercanas entre sí.
// Es importante que cada copia tenga su propia cadena para evitar gráficos circulares.
function staircase(offsetX, offsetY, rotation) {

  // Primera capa: una forma cuadrangular repetida verticalmente.
  // F1 controla su escala y la respiración del audio modifica su tamaño.
  let planes = shape(4, 0.5, 0.2)
    .scale(
      () => 1.05 + 0.3 * breathe() * (0.5 + F1),
      0.32
    )
    .repeatY(density)
    .rotate(() => -0.12 + rotation)
    .scrollX(() => driftX() + offsetX)
    .scrollY(() =>
      driftY() + offsetY + Math.sin(time * 0.18) * (0.03 + r1() * 0.08)
    )

  // Segunda capa: una oscilación que genera otra estructura repetida.
  // F1 y los medios de la batería modifican su frecuencia.
  // N11 aumenta la modulación producida por el ruido.
  let planes2 = osc(
    () => 2 + F1 * 3 + r2() * 2,
    0,
    0.5
  )
    .rotate(() => angle() + rotation)
    .scale(0.4, 0.5)
    .repeatY(() => 1 + F4 * 30)
    .scrollX(() => driftX() + offsetX)
    .scrollY(() => driftY() + offsetY)
    .modulate(
      noise(2, 0.15),
      () => 0.06 + N11 * (0.08 + r1() * 0.16)
    )
    .contrast(2)

  // Tercera capa: deforma los planos para producir el aspecto plegado.
  // N12 activa una deformación adicional y la batería también puede intensificarla.
  let folds = planes
    .modulateScale(
      noise(1.5, 0.25),
      () => 0.08 + N12 * (0.08 + r2() * 0.18)
    )
    .rotate(
      () => -0.15 + rotation + Math.sin(time * 0.27) * (0.03 + r1() * 0.08)
    )

  // Combina las capas anteriores para formar una escalera terminada.
  // La diferencia entre las formas genera la estructura gráfica final.
  return planes2
    .layer(
      folds
        .invert()
        .luma(0.45)
    )
    .diff(
      planes
        .rotate(0.08)
        .scrollX(() => driftX() * 0.5)
    )
}

// ------------------------------------------------------
// MULTIPLICACIÓN DE LA ESCALERA
// ------------------------------------------------------

// Define cuánto se separan las copias de la escalera principal.
// La separación es pequeña para que las estructuras puedan superponerse.
// N82 aumenta claramente ese desdoblamiento cuando se activa.
let spread = () =>
  0.018 + r2() * 0.045 + N82 * 0.055

// Escalera principal, ubicada en el centro de referencia.
let main = staircase(0, 0, 0)

// Primera copia: se desplaza ligeramente en X e Y y rota muy poco.
let copyA = staircase(
  () => spread(),
  () => -spread() * 0.7,
  () => 0.012 + Math.sin(time * 0.11) * 0.018
)

// Segunda copia: se desplaza en la dirección opuesta para crear superposición.
let copyB = staircase(
  () => -spread() * 0.85,
  () => spread() * 0.55,
  () => -0.012 + Math.cos(time * 0.09) * 0.018
)

// ------------------------------------------------------
// COMPOSICIÓN FINAL
// ------------------------------------------------------

// Superpone las tres escaleras.
// N82 aumenta la presencia de las copias y el audio agrega pequeñas variaciones.
main
  .add(copyA, () => 0.12 + N82 * 0.20 + r1() * 0.06)
  .add(copyB, () => 0.12 + N82 * 0.20 + r2() * 0.06)

  // Añade una modulación global muy suave para mantener vivo el resultado.
  .modulate(
    osc(1.5, 0.03, 0.5),
    () => 0.05 + r2() * 0.12
  )

  // Reduce la cantidad de niveles para darle un carácter gráfico más definido.
  .posterize(5, 0.6)

  // Refuerza el contraste de la estructura final.
  .contrast(1.4)

  // Envía el resultado a la salida de Hydra.
  .out()
