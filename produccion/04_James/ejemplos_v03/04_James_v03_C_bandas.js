// ============================================================
// 04_James_v03_C_bandas.js  ·  produccion/04_James/ejemplos_v03/
// Canción: 04_James (Gordo y Papu) · v03, ejemplo C: Bandas que respiran
// Idea: bandas que cruzan la pantalla partidas en tramos con escalones; el grosor respira de gorda a línea.
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

// ---- ajustes ----
const BANDAS = 4               // bandas horizontales en pantalla
const TRAMOS = [4, 5, 3, 6]    // en cuántos tramos se parte el ancho (cambia cada 2 compases)
const ESCALON = 0.5            // cuánto se desfasa cada tramo (en alturas de banda)
const GORDA = 0.62             // grosor máximo (fracción de cada banda)
const FINA = 0.03              // grosor mínimo: línea
const CAMBIO = 0.5             // negras que tarda en moverse a los escalones nuevos

// bandas: BANDAS bandas horizontales, el ancho partido en tramos, cada tramo
// corrido hacia arriba o abajo (los escalones). Todo en GLSL para que sea un solo paso.
setFunction({
  name: 'bandas', type: 'src',
  inputs: [
    { type: 'float', name: 'n', default: 4 }, { type: 'float', name: 'tramos', default: 4 },
    { type: 'float', name: 'grosor', default: 0.5 }, { type: 'float', name: 'amp', default: 0.5 },
    { type: 'float', name: 'semA', default: 0 }, { type: 'float', name: 'semB', default: 1 },
    { type: 'float', name: 'k', default: 0 },
  ],
  glsl: `
    float y = 1.0 - _st.y;
    float s = floor(_st.x * tramos);
    float hA = fract(sin(s * 12.9898 + semA * 78.233) * 43758.5453);
    float hB = fract(sin(s * 12.9898 + semB * 78.233) * 43758.5453);
    float off = (mix(hA, hB, k) - 0.5) * amp;
    float f = fract(y * n + off);
    float aa = n / resolution.y;
    float b = 1.0 - smoothstep(grosor * 0.5 - aa, grosor * 0.5 + aa, abs(f - 0.5));
    return vec4(vec3(b), 1.0);`
})

// el grosor respira en 8 negras: gorda 4 negras, se afina a línea, vuelve a engordar
const grosor = () => {
  const f = mod(nb(), 8)
  const latido = 1 - 0.12 * Math.exp(-frac(nb()) * 6)     // cada negra, un golpecito
  let g
  if (f < 4) g = GORDA
  else if (f < 5.5) g = GORDA + (FINA - GORDA) * suave((f - 4) / 1.5)
  else if (f < 6.5) g = FINA
  else g = FINA + (GORDA - FINA) * suave((f - 6.5) / 1.5)
  return g * latido
}
// escalones nuevos con cada compás
const k = () => suave(frac(nb() / 4) * 4 / CAMBIO)
// cada 8 compases: una negra de blanco total
const blanco = () => mod(nb(), 32) < 1 ? 1 : 0

bandas(BANDAS, () => TRAMOS[mod(Math.floor(nb() / 8), TRAMOS.length)], grosor, ESCALON,
       () => compas(), () => compas() + 1, k)
  .add(solid(1, 1, 1), blanco)
  .out(o0)

render(o0)
