// G&P — BUSCANDO PLACER — v1.12
// by Agu.Chino

// ======================================================
// 01 — SETUP
// ======================================================
// Carga la base de G&P, inicializa el audio de Buscando Placer
// y conecta los ocho faders del APC Mini.
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'buscandoplacer', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
// GP.midi.buttons(['N11'])

// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()

// ======================================================
// 02 — AUDIO
// ======================================================
// Línea de prueba para silenciar todos los stems.
// Está comentada para que el audio arranque normalmente.
// AUDIO — MUTE (true) / UNMUTE (false)========
// Object.values(GP.audio.stems).forEach(s => s.player.muted = true)
//

// ======================================================
// 03 — OSCILADOR PRINCIPAL
// ======================================================
// Oscilador base de baja frecuencia.
// Parámetro 1: frecuencia.
// Parámetro 2: velocidad.
// Parámetro 3: amplitud.
osc(1, 0.9, 300)

// ======================================================
// 04 — COLOR BASE
// ======================================================
// Define el color inicial de la imagen.
.color(0.9, 0.7, 0.8)

// ======================================================
// 05 — SEGUNDA CAPA / INTERFERENCIA
// ======================================================
// Un segundo oscilador se mezcla mediante diff.
// Esta es la principal estructura de trama/interferencia del sketch.
.diff(
  osc(45, 0.3, 100)

  // Color blanco de la segunda capa.
  .color(0.9, 0.9, 0.9)

  // Rotación fija: actualmente no modifica el ángulo.
  .rotate(0.0)

  // Convierte la segunda capa en una estructura pixelada.
  .pixelate(12)

  // Duplica radialmente la estructura.
  .kaleid(2)
)

// ======================================================
// 06 — DESPLAZAMIENTO
// ======================================================
// Desplaza horizontalmente la imagen completa.
.scrollX(10)

// ======================================================
// 07 — COLORAMA
// ======================================================
// Modifica/cicla la información cromática de la imagen.
.colorama()

// ======================================================
// 08 — LUMA
// ======================================================
// Usa la luminancia para recortar/transformar la imagen.
.luma()

// ======================================================
// 09 — REPETICIÓN
// ======================================================
// Mantiene una repetición horizontal y vertical de una sola copia.
.repeatX(1)
.repeatY(1)

// ======================================================
// 10 — MODULACIÓN
// ======================================================
// Un tercer oscilador deforma espacialmente la imagen anterior.
.modulate(
  osc(1, -0.9, 300)
)

// ======================================================
// 11 — ESCALA
// ======================================================
// Amplía la composición final al doble.
.scale(2)

// ======================================================
// 12 — SALIDA
// ======================================================
.out()
