// ============================================================
// 04_James_v03_F_cortes.js  ·  produccion/04_James/ejemplos_v03/
// Canción: 04_James (Gordo y Papu) · v03, ejemplo F: Cortes
// Idea: cuatro maneras de cortar de una imagen a otra: seco, barrido, pliegue y blanco total.
// Referencia: videos de Milian Mori (pantalla curva → acá plana). Sólo rectángulos, blanco puro.
// Se pega solo en el editor de Hydra (sin MIDI, sin tools): Ctrl+Shift+Enter.
// Actualizado: 20/10/2026
// ============================================================

// ---- reloj de prueba: hace de música hasta que conectemos el MIDI ----
const BPM = 136
const negra = 60 / BPM
const nb = () => time / negra                                  // negras desde que arrancó (con decimales)
const compas = () => Math.floor(nb() / 4)                      // compás actual (4 negras)

// ---- ayudas ----
const clamp01 = v => Math.max(0, Math.min(1, v))
const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2
const mod = (a, n) => ((a % n) + n) % n
const frac = x => x - Math.floor(x)
const azar = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453)   // número fijo entre 0 y 1 para (a, b)

// caja: un rectángulo blanco de borde duro. x0..x1 de izquierda a derecha,
// y0..y1 de ARRIBA hacia abajo (0 = arriba, 1 = abajo), en proporción de pantalla.
setFunction({
  name: 'caja', type: 'src',
  inputs: [
    { type: 'float', name: 'x0', default: 0.25 }, { type: 'float', name: 'x1', default: 0.75 },
    { type: 'float', name: 'y0', default: 0.25 }, { type: 'float', name: 'y1', default: 0.75 },
  ],
  glsl: `
    float y = 1.0 - _st.y;
    float ax = 0.7 / resolution.x, ay = 0.7 / resolution.y;
    float h = smoothstep(x0 - ax, x0 + ax, _st.x) * (1.0 - smoothstep(x1 - ax, x1 + ax, _st.x));
    float v = smoothstep(y0 - ay, y0 + ay, y) * (1.0 - smoothstep(y1 - ay, y1 + ay, y));
    return vec4(vec3(h * v), 1.0);`
})

// ---- ajustes ----
const CADA = 8                // negras entre un corte y el siguiente
// Dos imágenes de prueba (o1 y o2) y cuatro maneras de cortar de una a la otra,
// pensadas para marcar los cortes de la canción:
//   'seco'      cambia de una
//   'barrido'   un borde vertical cruza la pantalla y deja la imagen nueva
//   'pliegue'   la imagen se aplasta hasta una línea horizontal y se abre la nueva
//   'blanco'    una negra de blanco total y aparece la nueva
const CORTES = ['seco', 'barrido', 'pliegue', 'blanco']
const DUR = { seco: 0, barrido: 0.75, pliegue: 1, blanco: 1 }   // en negras

// imagen 1: bandas horizontales gruesas · imagen 2: columnas verticales
let bandas1 = solid(0, 0, 0)
;[[0.15, 0.3], [0.45, 0.55], [0.7, 0.85]].forEach(([a, b]) => { bandas1 = bandas1.add(caja(0.05, 0.95, a, b)) })
bandas1.out(o1)
let columnas = solid(0, 0, 0)
;[[0.1, 0.2], [0.3, 0.33], [0.45, 0.55], [0.67, 0.7], [0.8, 0.9]].forEach(([a, b]) => { columnas = columnas.add(caja(a, b, 0.2, 0.8)) })
columnas.out(o2)

const n = () => Math.floor(nb() / CADA)                  // cuántos cortes van
const tipo = () => CORTES[mod(n(), CORTES.length)]
const k = () => {                                         // avance del corte actual (0 → 1)
  const d = DUR[tipo()]
  return d === 0 ? 1 : clamp01(mod(nb(), CADA) / d)
}
const vieja = () => mod(n() - 1, 2), nueva = () => mod(n(), 2)
const de = o => () => (o === 1 ? (vieja() === 0 ? 1 : 0) : (nueva() === 0 ? 1 : 0))

// mezcla según el tipo de corte
const mascaraNueva = () => {                              // cuánto se ve la nueva (para barrido: hasta dónde)
  const t = tipo(), x = k()
  if (t === 'seco') return 1
  if (t === 'barrido') return suave(x)
  if (t === 'pliegue') return x < 0.5 ? 0 : 1
  return x < 1 ? 0 : 1
}
const aplastar = () => {                                  // pliegue: la altura de la imagen
  if (tipo() !== 'pliegue') return 1
  const x = k()
  return Math.max(0.003, x < 0.5 ? 1 - suave(x * 2) : suave((x - 0.5) * 2))
}
const blanco = () => tipo() === 'blanco' && k() < 1 ? 1 : 0

// la vieja y la nueva (cada una puede ser o1 u o2)
const imagen = cual => src(o1).mult(solid(de(cual), de(cual), de(cual)))
  .add(src(o2).mult(solid(() => 1 - de(cual)(), () => 1 - de(cual)(), () => 1 - de(cual)())))

imagen(1).mult(caja(mascaraNueva, 1, 0, 1))
  .add(imagen(2).mult(caja(0, mascaraNueva, 0, 1)))
  .scale(1, 1, aplastar)
  .add(solid(1, 1, 1), blanco)
  .out(o0)

render(o0)
