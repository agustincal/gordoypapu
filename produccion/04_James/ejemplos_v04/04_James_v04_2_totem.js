// ============================================================
// 04_James_v04_2_totem.js  ·  produccion/04_James/ejemplos_v04/
// Canción: 04_James (Gordo y Papu) · v04, ejemplo 2: Tótem
// Idea: cada fila respira a su ritmo y con su temperamento, por momentos se ponen de acuerdo; varias copias se desplazan a distintas velocidades y se cruzan.
// Todo son individuos independientes: donde se cruzan se invierten (diff) o se funden (thresh).
// Sólo rectángulos, blanco puro, pantalla plana completa.
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

// ---- lienzos: cada individuo se dibuja con JavaScript y entra a Hydra como imagen ----
//   s0 = los que se INVIERTEN al cruzarse (diff: blanco sobre blanco = negro)
//   s1 = los que se FUNDEN al acercarse (halo suave + umbral: se tocan y se vuelven una forma)
// Hydra después corta todo con thresh (borde duro, blanco puro) y cruza las dos capas con diff.
const RES = [640, 360]
const lienzo = k => {
  const c = window['_jamesLienzo' + k] || (window['_jamesLienzo' + k] = document.createElement('canvas'))
  c.width = RES[0]; c.height = RES[1]
  return c
}
const L0 = lienzo(0), L1 = lienzo(1)
const g0 = L0.getContext('2d'), g1 = L1.getContext('2d')
s0.init({ src: L0, dynamic: true })
s1.init({ src: L1, dynamic: true })

// rectángulo: [x, y, ancho, alto] con x, y = centro (0 a 1, y de arriba hacia abajo)
const rect = (g, [x, y, w, h]) => g.fillRect((x - w / 2) * RES[0], (y - h / 2) * RES[1], w * RES[0], h * RES[1])
// los que se invierten: cada uno da vuelta lo que tiene abajo
const pintarDiff = (g, rects, fondoBlanco = false) => {
  g.globalCompositeOperation = 'source-over'; g.filter = 'none'
  g.fillStyle = fondoBlanco ? '#fff' : '#000'; g.fillRect(0, 0, RES[0], RES[1])
  g.globalCompositeOperation = 'difference'; g.fillStyle = '#fff'
  rects.forEach(r => rect(g, r))
  g.globalCompositeOperation = 'source-over'
}
// los que se funden: halos que se suman (el umbral de Hydra los corta en 0.5)
const pintarFusion = (g, rects, halo) => {
  g.globalCompositeOperation = 'source-over'; g.filter = 'none'
  g.fillStyle = '#000'; g.fillRect(0, 0, RES[0], RES[1])
  g.globalCompositeOperation = 'lighter'; g.filter = `blur(${halo}px)`; g.fillStyle = '#fff'
  rects.forEach(r => rect(g, r))
  g.filter = 'none'; g.globalCompositeOperation = 'source-over'
}
// salida: las dos capas cortadas con umbral y cruzadas con diff
const salida = () => src(s0).thresh(0.5, 0.02).diff(src(s1).thresh(0.5, 0.02))

// ---- ajustes ----
const BARRAS = 9                 // filas del tótem
const ANCHO = 0.7                // cuánto se estira una fila histriónica (fracción de pantalla)
const HUECO = 0.03               // hueco central (con dos agujas)
const HALO = 10
const ACOMPASA = 16              // cada cuántas negras las filas se ponen de acuerdo (4 negras juntas)
// copias del tótem: cada una entra en su negra, se desplaza a su velocidad y cruza a las otras
//   x: dónde arranca · vel: pantallas por segundo (signo = dirección) · alto: tamaño · desde: negra en que aparece
const COPIAS = [
  { x: 0.5,  vel: 0.012,  alto: 0.75, desde: 0,  funde: false },
  { x: 0.05, vel: -0.03,  alto: 0.5,  desde: 6,  funde: false },
  { x: 0.85, vel: 0.05,   alto: 0.35, desde: 12, funde: true },
  { x: 0.3,  vel: -0.08,  alto: 0.25, desde: 20, funde: false },
]

// cada fila: su ciclo, su temperamento (0 = calma · 1 = histriónica), su forma
const filas = Array.from({ length: BARRAS }, (_, i) => ({
  ciclo: [3, 4, 5, 6, 8][Math.floor(azar(i, 1) * 5)],     // negras de su respiración
  fase: azar(i, 2),
  temple: azar(i, 3),
  izq: 0.45 + 0.55 * azar(i, 4),
  der: 0.45 + 0.55 * azar(i, 5),
  kick: 0,
}))

// 0 = cada fila a su ritmo · 1 = todas juntas
const acuerdo = () => {
  const f = mod(nb(), ACOMPASA)
  return f < 10 ? 0 : f < 11 ? suave(f - 10) : f < 14 ? 1 : f < 15 ? 1 - suave(f - 14) : 0
}

// cuánto está abierta cada fila (0 a 1)
const abierta = (fila, i) => {
  const propia = frac(nb() / fila.ciclo + fila.fase)
  const comun = frac(nb() / 4)
  const a = acuerdo()
  const fase = propia + (comun - propia) * a
  const forma = fila.temple > 0.5
    ? Math.pow(Math.max(0, Math.sin(Math.PI * fase)), 0.35)        // histriónica: abre de golpe, se queda
    : Math.pow(Math.max(0, Math.sin(Math.PI * fase)), 2)           // calma: abre y cierra despacio
  const amplitud = 0.25 + 0.75 * fila.temple
  return forma * amplitud * (1 + fila.kick * 0.5)
}

const filasDe = (copia, cx) => {
  const r = []
  const alto = copia.alto, y0 = 0.5 - alto / 2, paso = alto / BARRAS
  const g = HUECO / 2 * alto * 1.5
  filas.forEach((f, i) => {
    const y = y0 + (i + 0.5) * paso, h = paso * 0.55
    const w = ANCHO * alto * abierta(f, i)
    const wl = Math.max(0.004, w * f.izq / 2), wr = Math.max(0.004, w * f.der / 2)
    r.push([cx - g - wl / 2, y, wl, h], [cx + g + wr / 2, y, wr, h])
    r.push([cx - g / 2, y, 0.003, h], [cx + g / 2, y, 0.003, h])    // las dos agujas
  })
  return r
}

let ultimo = 0, negraAnt = -1
update = () => {
  const dt = Math.min(0.1, Math.max(0, time - ultimo)); ultimo = time
  const n = Math.floor(nb()), golpe = n !== negraAnt; negraAnt = n
  filas.forEach((f, i) => { if (golpe && f.temple > 0.6 && azar(i, n) < 0.5) f.kick = 1; f.kick *= Math.exp(-dt * 10) })
  const r0 = [], r1 = []
  COPIAS.forEach(c => {
    if (nb() < c.desde) return
    const cx = mod(c.x + c.vel * time + 0.3, 1.6) - 0.3
    ;(c.funde ? r1 : r0).push(...filasDe(c, cx))
  })
  pintarDiff(g0, r0)
  pintarFusion(g1, r1, HALO)
}

salida().out(o0)
render(o0)
