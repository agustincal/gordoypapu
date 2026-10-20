// ============================================================
// 04_James_v03_D_puertas.js  ·  produccion/04_James/ejemplos_v03/
// Canción: 04_James (Gordo y Papu) · v03, ejemplo D: Puertas
// Idea: paneles que se abren y se pliegan hacia una línea; negro; golpe de sala entera y barrido.
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
const ALTO = [0.22, 0.78]      // franja de la pantalla donde viven los paneles (de arriba a abajo)
const ABRE = 0.12              // negras que tarda en abrir (casi seco)
const SOSTIENE = 1             // negras que queda abierto
const CIERRA = 0.6             // negras que tarda en plegarse hasta la línea
const LINEA = 0.004            // ancho de la línea final antes de desaparecer
const PROB = 0.6               // chance de que cada panel se prenda en cada ciclo

// Paneles: [x0, x1, hacia dónde se pliega (0 = izquierda · 0.5 = centro · 1 = derecha)]
const PANELES = [
  [0.03, 0.10, 1],
  [0.12, 0.33, 0],
  [0.42, 0.58, 0.5],           // la puerta del centro
  [0.64, 0.67, 1],
  [0.67, 0.86, 0],
  [0.89, 0.98, 0],
]

// Una frase de 16 negras:
//   negras 0, 3, 6  → ciclos: cada panel se abre (o no), se sostiene y se pliega a una línea
//   negras 9 a 12   → negro
//   negra 12        → golpe: la sala entera se prende de una
//   negras 14.5–16  → se cierra en barrido de derecha a izquierda
const frase = () => mod(nb(), 16)
const nFrase = () => Math.floor(nb() / 16)

// cuánto está abierto un panel (1 = entero · 0 = línea · -1 = apagado) y en qué ciclo
const estado = i => {
  const f = frase()
  if (f >= 12) return f < 14.5 ? 1 : 1                    // golpe: todo prendido (el barrido lo recorta)
  if (f >= 9) return -1                                   // negro
  const ciclo = Math.floor(f / 3), k = f - ciclo * 3       // negra dentro del ciclo
  if (azar(i + 1, nFrase() * 3 + ciclo) > PROB && i !== 2) return -1
  if (k < ABRE) return suave(k / ABRE)
  if (k < ABRE + SOSTIENE) return 1
  const c = (k - ABRE - SOSTIENE) / CIERRA
  return c < 1 ? 1 - suave(c) : (c < 1.4 ? 0 : -1)        // queda un instante como línea y se apaga
}
const borde = (i, lado) => () => {
  const [a, b, ancla] = PANELES[i]
  const e = estado(i)
  if (e < 0) return lado === 0 ? 2 : 2                    // fuera de pantalla = apagado
  const w = Math.max(LINEA, (b - a) * e)
  const centro = a + (b - a) * ancla + (ancla === 0 ? w / 2 : ancla === 1 ? -w / 2 : 0)
  return lado === 0 ? centro - w / 2 : centro + w / 2
}
// barrido final de la frase: la luz se va de derecha a izquierda
const barrido = () => { const f = frase(); return f < 14.5 ? 1 : 1 - suave((f - 14.5) / 1.5) }

let luz = solid(0, 0, 0)
PANELES.forEach((_, i) => { luz = luz.add(caja(borde(i, 0), borde(i, 1), ALTO[0], ALTO[1])) })
luz
  .mult(caja(0, barrido, 0, 1))
  .out(o0)

render(o0)
