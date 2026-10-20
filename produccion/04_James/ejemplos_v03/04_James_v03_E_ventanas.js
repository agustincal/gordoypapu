// ============================================================
// 04_James_v03_E_ventanas.js  ·  produccion/04_James/ejemplos_v03/
// Canción: 04_James (Gordo y Papu) · v03, ejemplo E: Ventanas
// Idea: pantalla blanca, rayas y un bloque negro; donde se cruzan (diff) aparecen ventanas.
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
const RAYAS = [               // rayas negras que cruzan toda la pantalla: [arriba, abajo]
  [0.30, 0.42],
  [0.70, 0.80],
]
const BLOQUE = 0.36           // ancho máximo del bloque negro central
const BLOQUES = [0.36, 0.2, 0.5, 0]     // el ancho del bloque en cada compás (0 = pantalla abierta)

// Pantalla blanca. Las rayas negras la cruzan y un bloque negro ocupa el centro.
// Con diff, donde la raya pasa por el bloque se invierte: aparecen ventanas blancas.
// Con cada negra las rayas se corren un poco; con cada compás el bloque cambia de ancho.
const anchoBloque = () => {
  const c = compas(), f = frac(nb() / 4) * 4
  const a = BLOQUES[mod(c - 1, BLOQUES.length)], b = BLOQUES[mod(c, BLOQUES.length)]
  return a + (b - a) * suave(f / 0.4)
}
const corrimiento = j => () => 0.04 * Math.sin(Math.floor(nb()) * 1.7 + j * 2) * suave(frac(nb()) / 0.25)

let img = solid(1, 1, 1)
RAYAS.forEach(([a, b], j) => {
  img = img.diff(caja(0, 1, () => a + corrimiento(j)(), () => b + corrimiento(j)()))
})
img = img.diff(caja(() => 0.5 - anchoBloque() / 2, () => 0.5 + anchoBloque() / 2, 0, 1))
img.out(o0)

render(o0)
