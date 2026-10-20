// ============================================================
// 04_James_v03_A_laberinto.js  ·  produccion/04_James/ejemplos_v03/
// Canción: 04_James (Gordo y Papu) · v03, ejemplo A: Laberinto
// Idea: filas de barras partidas en pedazos que se deslizan; con cada negra saltan una celda.
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
const FILAS = 7                // filas de barras
const CELDAS = 9               // celdas por fila (el largo de cada pedazo)
const LLENO = 0.62             // grosor de cada barra dentro de su fila
const HUECOS = [0.35, 0.5, 0.25, 0.6]   // proporción de huecos (cambia cada 4 compases)
const DERIVA = 0.08            // deslizamiento continuo (celdas por negra)
const SALTO = 0.35             // negras que tarda cada fila en saltar una celda
const ESCALON = 0.25           // cada pedazo un poco más arriba o abajo

// laberinto: filas de barras partidas en pedazos. Las filas pares van para un
// lado y las impares para el otro: con cada negra saltan una celda.
setFunction({
  name: 'laberinto', type: 'src',
  inputs: [
    { type: 'float', name: 'filas', default: 7 }, { type: 'float', name: 'celdas', default: 9 },
    { type: 'float', name: 'mov', default: 0 }, { type: 'float', name: 'lleno', default: 0.6 },
    { type: 'float', name: 'hueco', default: 0.4 }, { type: 'float', name: 'escalon', default: 0.2 },
  ],
  glsl: `
    float y = 1.0 - _st.y;
    float r = floor(y * filas);
    float dir = mod(r, 2.0) * 2.0 - 1.0;
    float vel = 0.6 + 0.8 * fract(sin(r * 91.7) * 4375.85);
    float x = _st.x * celdas + dir * mov * vel + r * 3.7;
    float c = floor(x);
    float on = step(hueco, fract(sin(c * 12.9898 + r * 78.233) * 43758.5453));
    float off = (fract(sin(c * 39.34 + r * 11.13) * 9631.7) - 0.5) * escalon;
    float fy = fract(y * filas) + off;
    float aa = filas / resolution.y;
    float barra = smoothstep(0.5 - lleno * 0.5 - aa, 0.5 - lleno * 0.5 + aa, fy)
                * (1.0 - smoothstep(0.5 + lleno * 0.5 - aa, 0.5 + lleno * 0.5 + aa, fy));
    return vec4(vec3(on * barra), 1.0);`
})

// movimiento: un salto suave por negra + deriva continua
const mov = () => Math.floor(nb()) + suave(frac(nb()) / SALTO) + nb() * DERIVA

laberinto(FILAS, CELDAS, mov, LLENO, () => HUECOS[mod(Math.floor(nb() / 16), HUECOS.length)], ESCALON)
  .out(o0)

render(o0)
