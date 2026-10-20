// ============================================================
// 04_James_v04_4_ventanas.js  ·  produccion/04_James/ejemplos_v04/
// Canción: 04_James (Gordo y Papu) · v04, ejemplo 4: Ventanas
// Idea: bandas y bloques independientes sobre blanco que se cruzan con diff: las ventanas aparecen donde se pisan.
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
// Pantalla blanca. Bandas horizontales y bloques verticales, cada uno con su vida,
// se cruzan con diff: donde se pisan se invierte y aparecen las ventanas.
//   modo 'suave' = va y viene despacio · 'salta' = cambia de lugar con las negras
//   vel = vueltas por compás · amp = cuánto se mueve · respira = el grosor late
const HORIZONTALES = [
  { y: 0.30, alto: 0.10, amp: 0.05, vel: 0.25,  modo: 'suave' },
  { y: 0.55, alto: 0.04, amp: 0.25, vel: 1,     modo: 'salta' },
  { y: 0.78, alto: 0.13, amp: 0.03, vel: 0.125, modo: 'suave', respira: true },
  { y: 0.12, alto: 0.02, amp: 0.35, vel: 0.5,   modo: 'suave' },
  { y: 0.66, alto: 0.06, amp: 0.15, vel: 0.5,   modo: 'salta', largo: 0.45 },
]
const VERTICALES = [
  { x: 0.50, ancho: 0.30, amp: 0.08, vel: 0.125, modo: 'suave', respira: true },
  { x: 0.18, ancho: 0.05, amp: 0.30, vel: 0.5,   modo: 'salta' },
  { x: 0.82, ancho: 0.12, amp: 0.12, vel: 0.25,  modo: 'suave' },
  { x: 0.65, ancho: 0.02, amp: 0.25, vel: 1,     modo: 'salta', largo: 0.6 },
]
const SALTO = 0.3                // negras que tarda un salto

// posición de un elemento (base + movimiento propio)
const mover = (e, i) => {
  if (e.modo === 'salta') {
    const cadaN = Math.max(1, Math.round(1 / e.vel))      // salta cada tantas negras
    const n = Math.floor(nb() / cadaN)
    const a = (azar(i, n) - 0.5) * 2 * e.amp, b = (azar(i, n + 1) - 0.5) * 2 * e.amp
    return a + (b - a) * suave(frac(nb() / cadaN) * cadaN / SALTO)
  }
  return e.amp * Math.sin(nb() / 4 * e.vel * Math.PI * 2 + i * 1.7)
}
const late = e => e.respira ? 1 + 0.35 * Math.sin(nb() / 8 * Math.PI * 2) : 1

update = () => {
  const r = []
  HORIZONTALES.forEach((e, i) => {
    const largo = e.largo || 1
    const x = largo < 1 ? 0.5 + mover({ ...e, amp: 0.3 }, i + 50) : 0.5
    r.push([x, e.y + mover(e, i), largo + 0.01, e.alto * late(e)])
  })
  VERTICALES.forEach((e, i) => {
    const largo = e.largo || 1
    const y = largo < 1 ? 0.5 + mover({ ...e, amp: 0.2 }, i + 70) : 0.5
    r.push([e.x + mover(e, i + 20), y, e.ancho * late(e), largo + 0.01])
  })
  pintarDiff(g0, r, true)
  pintarFusion(g1, [], 1)
}

salida().out(o0)
render(o0)
