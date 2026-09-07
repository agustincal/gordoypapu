// ==========================================================
// GyP — RANDOM RECTANGLES v0.2
// DRUM TRIGGER / TRIADIC-HARMONIC COLOR PALETTE
// ==========================================================

// ==========================================================
// 01 — AUDIO / STEMS
// ==========================================================

await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp/gp-base-AkaiMini-v0.6.js')
await GP.init({song:'buscandoplacer', midi:true})
await GP.audio.start()

// Stems disponibles:
// bass / drums / synth / vocals

// ==========================================================
// 02 — CONFIGURACIÓN
// ==========================================================

// Sensibilidad del disparo de drums.
// Subir = menos disparos / bajar = más disparos.
const DRUM_THRESHOLD = 0.20;

// Tiempo mínimo entre dos disparos.
// Evita que un mismo golpe genere varios estados.
const DRUM_COOLDOWN = 0.10;

// ==========================================================
// 03 — RANDOM DETERMINISTA
// ==========================================================

function rnd(n, seed) {
  let x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ==========================================================
// 04 — ESTADO
// ==========================================================

// El estado S NO avanza con el tiempo.
// Solo cambia cuando detectamos un golpe de drums.
let S = 0;
let lastDrum = 0;

// ==========================================================
// 05 — REACTIVO DE DRUMS
// ==========================================================

let drumReact = () => Math.max(0, drums.mid() - DRUM_THRESHOLD);

// ==========================================================
// 06 — DETECCIÓN DE GOLPE
// ==========================================================

let drum = drums.mid();

if (drum > DRUM_THRESHOLD && time - lastDrum > DRUM_COOLDOWN) {
  S++;
  lastDrum = time;
}

// ==========================================================
// 07 — HSV → RGB
// ==========================================================

function hsv(h, s, v) {
  h = ((h % 360) + 360) % 360;

  let c = v * s;
  let x = c * (1 - Math.abs((h / 60) % 2 - 1));
  let m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c; g = x; b = 0;
  } else if (h < 120) {
    r = x; g = c; b = 0;
  } else if (h < 180) {
    r = 0; g = c; b = x;
  } else if (h < 240) {
    r = 0; g = x; b = c;
  } else if (h < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return [r + m, g + m, b + m];
}

// ==========================================================
// 08 — PALETA
// ==========================================================

// Cada golpe genera una paleta nueva.
// La estructura cromática sigue siendo triádica.
let H = rnd(S, 100) * 360;

let PAL = [
  hsv(H,       1.00, 0.60),
  hsv(H + 120, 1.00, 0.60),
  hsv(H + 240, 1.00, 0.60),
  hsv(H + 120, 0.45, 1.00),
  hsv(H + 240, 0.55, 0.25)
];

// ==========================================================
// 09 — RECTÁNGULO
// ==========================================================

function rectangle(i) {
  let seed = S * 100 + i * 37;

  // POSICIÓN — cambia solamente al llegar un drum nuevo
  let x = rnd(seed, 1) * 1.25 - 0.625;
  let y = rnd(seed, 2) * 1.25 - 0.625;

  // TAMAÑO — rectángulos grandes
  let w = 0.9 + rnd(seed, 3) * 0.75;
  let h = 0.8 + rnd(seed, 4) * 0.75;

  // COLOR
  let c = Math.floor(rnd(seed, 5) * PAL.length);
  let col = PAL[c];

  return solid(col[0], col[1], col[2])
    .mask(
      shape(4, 0.5, 0.001)
        .scale(w, h)
        .scrollX(x)
        .scrollY(y)
    );
}

// ==========================================================
// 10 — CANTIDAD DE RECTÁNGULOS
// ==========================================================

function rectangleCount() {
  let r = rnd(S, 999);

  if (r < 0.10) return 1;
  if (r < 0.25) return 2;
  if (r < 0.50) return 3;
  if (r < 0.75) return 4;
  if (r < 0.92) return 5;

  return 6;
}

// ==========================================================
// 11 — COMPOSICIÓN
// ==========================================================

let count = rectangleCount();
let comp = rectangle(0);

// El último rectángulo queda arriba y tapa completamente
// al anterior. No hay transparencia ni blending.

for (let i = 1; i < count; i++) {
  comp = comp.layer(rectangle(i));
}

// ==========================================================
// 12 — OUTPUT
// ==========================================================

comp.out(o0);
