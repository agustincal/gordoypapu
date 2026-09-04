// G&P — BUSCANDO PLACER — v1.1
// by Agu.Chino

// ======================================================
// 01 — SETUP
// ======================================================
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'buscandoplacer', midi:true})
await GP.audio.start()
GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
GP.midi.buttons(['N11','N12','N13','N14','N15','N16'])

// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()

// AUDIO — MUTE (true) / UNMUTE (false)========
// Object.values(GP.audio.stems).forEach(s => s.player.muted = true)

// ======================================================
// 02 — AUDIO REACTIVO
// ======================================================
// Por ahora dejamos los stems disponibles, pero sin decidir
// todavía qué controlará cada uno.
let bassReact = () => bass.low()
let drumReact = () => drums.mid()
let synthReact = () => synth.mid()
let vocalReact = () => vocals.high()

// ======================================================
// 03 — OSCILADOR PRINCIPAL
// ======================================================
// F1 modifica la frecuencia.
// F2 modifica la velocidad de movimiento.
// F3 modifica la amplitud.
osc(
  () => 1 + F1 * 8,
  () => 0.9 + F2 * 0.8,
  () => 300 + F3 * 300
)

// ======================================================
// 04 — SEGUNDO OSCILADOR / TRAMA
// ======================================================
// Esta capa genera la estructura de interferencia.
// F4 queda reservado para decidir luego su comportamiento.
.diff(
  osc(45, 0.3, 100)
    .color(0.9, 0.9, 0.9)
    .rotate(0.0)
    .pixelate(12)
    .kaleid(2)
)

// ======================================================
// 05 — DESPLAZAMIENTO Y COLOR
// ======================================================
// F5–F6 quedan libres para experimentar con desplazamiento
// y transformación cromática.
.scrollX(() => 0.5 + F5 * 10)
.colorama(() => F6 * 0.15)

// ======================================================
// 06 — REPETICIÓN
// ======================================================
.repeatX(1)
.repeatY(1)

// ======================================================
// 07 — MODULACIÓN
// ======================================================
// F7 modifica la intensidad de la modulación.
.modulate(
  osc(1, -0.9, 300),
  () => F7 * 0.35
)

// ======================================================
// 08 — ESCALA / CONTRASTE
// ======================================================
// F8 controla la escala final.
.scale(() => 1 + F8 * 2)
.contrast(() => 1 + F8 * 0.3)

// ======================================================
// 09 — SALIDA
// ======================================================
.out()
