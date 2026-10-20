// ============================================================
// 04_James_v03_B_totem.js  ·  produccion/04_James/ejemplos_v03/
// Canción: 04_James (Gordo y Papu) · v03, ejemplo B: Tótem
// Idea: una pila de barras dentadas que aparece como columna, se estira, se recoge a dos agujas y se apaga.
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
const BARRAS = 7               // barras apiladas del tótem
const CICLO = 8                // negras que dura una respiración
const ANCHO_MAX = 0.85         // cuánto se estira (fracción de pantalla)
const HUECO = 0.035            // hueco central (con dos agujas adentro)
const LUGARES = [0.5, 0.68, 0.32, 0.55]    // dónde aparece cada vez (x)
const ALTOS = [0.45, 0.55, 0.65, 0.75]     // cada vez un poco más alto

// tótem: barras apiladas, partidas por un hueco central con dos agujas.
// Cada barra tiene su propio largo a izquierda y derecha: el borde queda dentado.
setFunction({
  name: 'totem', type: 'src',
  inputs: [
    { type: 'float', name: 'xc', default: 0.5 }, { type: 'float', name: 'ancho', default: 0.3 },
    { type: 'float', name: 'alto', default: 0.5 }, { type: 'float', name: 'barras', default: 7 },
    { type: 'float', name: 'hueco', default: 0.03 }, { type: 'float', name: 'agujas', default: 1 },
    { type: 'float', name: 'sem', default: 0 },
  ],
  glsl: `
    float y = 1.0 - _st.y;
    float yy = (y - (0.5 - alto * 0.5)) / max(alto, 0.001);
    float dentro = step(0.0, yy) * step(yy, 1.0);
    float i = floor(yy * barras);
    float fy = fract(yy * barras);
    float barra = step(0.2, fy) * step(fy, 0.8);
    float hl = fract(sin(i * 12.9898 + sem * 7.13) * 43758.5453);
    float hr = fract(sin(i * 78.233 + sem * 3.71) * 43758.5453);
    float dx = _st.x - xc;
    float g = hueco * 0.5;
    float wl = ancho * 0.5 * (0.45 + 0.55 * hl);
    float wr = ancho * 0.5 * (0.45 + 0.55 * hr);
    float ax = 0.7 / resolution.x;
    float izq = smoothstep(-wl - g - ax, -wl - g + ax, dx) * (1.0 - smoothstep(-g - ax, -g + ax, dx));
    float der = smoothstep(g - ax, g + ax, dx) * (1.0 - smoothstep(wr + g - ax, wr + g + ax, dx));
    float ag = agujas * (1.0 - smoothstep(0.0015, 0.0015 + ax, abs(abs(dx) - g * 0.5)));
    return vec4(vec3(clamp((izq + der + ag) * barra * dentro, 0.0, 1.0)), 1.0);`
})

// una respiración de CICLO negras:
//   0      aparece como columna angosta (seco)
//   0.5–3  se estira hacia los costados
//   3–5    se sostiene
//   5–6    se recoge hasta quedar en las agujas
//   6–6.5  quedan sólo las agujas
//   6.5–8  negro
const fase = () => mod(nb(), CICLO)
const vez = () => Math.floor(nb() / CICLO)
const ancho = () => {
  const f = fase()
  if (f < 0.5) return 0.04
  if (f < 3) return 0.04 + (ANCHO_MAX - 0.04) * suave((f - 0.5) / 2.5)
  if (f < 5) return ANCHO_MAX * (1 + 0.03 * Math.sin(f * Math.PI))
  if (f < 6) return ANCHO_MAX * (1 - suave(f - 5))
  return 0
}
const agujas = () => fase() < 6.5 ? 1 : 0
const alto = () => ALTOS[mod(vez(), ALTOS.length)]
const lugar = () => LUGARES[mod(vez(), LUGARES.length)]

totem(lugar, ancho, alto, BARRAS, HUECO, agujas, vez)
  .out(o0)

render(o0)
