// ============================================================
// 04_James_v04_1_multitud.js  ·  produccion/04_James/ejemplos_v04/
// Canción: 04_James (Gordo y Papu) · v04, ejemplo 1: Multitud
// Idea: individuos de distintos tamaños, velocidades y direcciones (calmos e histriónicos) que se cruzan invirtiéndose o fundiéndose; cada tanto se organizan en bandas con escalones y se vuelven a soltar.
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
const CUANTOS = 44              // individuos
const CALMOS = 0.55             // proporción de calmos (lentos, grandes); el resto son histriónicos
const FUNDEN = 0.3              // proporción que se funde en vez de invertirse
const HALO = 10                 // tamaño del halo de los que se funden
const BANDAS = 4                // cuando la multitud se organiza: en cuántas bandas
const ESCALON = 0.07            // escalones entre tramos cuando están organizados
const CICLO = 32                // negras de un ciclo de organización:
                                //   0–14 libres · 14–18 se organizan · 18–26 organizados (respiran) · 26–30 se sueltan

// cada individuo: su tamaño, su velocidad, su dirección, su temperamento
const gente = Array.from({ length: CUANTOS }, (_, i) => {
  const calmo = azar(i, 1) < CALMOS
  const horizontal = azar(i, 2) < 0.8
  const ang = horizontal
    ? (azar(i, 3) < 0.5 ? 0 : Math.PI) + (azar(i, 4) - 0.5) * 0.25
    : (azar(i, 3) < 0.5 ? 1 : -1) * Math.PI / 2
  const vel = calmo ? 0.015 + 0.04 * azar(i, 5) : 0.06 + 0.22 * azar(i, 5)    // pantallas por segundo
  return {
    calmo,
    funde: azar(i, 6) < FUNDEN,
    x: azar(i, 7), y: azar(i, 8),
    vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel * 0.6,
    w: calmo ? 0.1 + 0.28 * azar(i, 9) : 0.015 + 0.07 * azar(i, 9),
    h: calmo ? 0.03 + 0.08 * azar(i, 10) : 0.01 + 0.035 * azar(i, 10),
    kick: 0,                                        // salto de tamaño (histriónicos)
    banda: i % BANDAS,                              // su lugar cuando la multitud se organiza
    tramo: Math.floor(i / BANDAS),
  }
})
const TRAMOS = Math.ceil(CUANTOS / BANDAS)

// cuánto está organizada la multitud (0 = libre · 1 = bandas)
const orden = () => {
  const f = mod(nb(), CICLO)
  if (f < 14) return 0
  if (f < 18) return suave((f - 14) / 4)
  if (f < 26) return 1
  if (f < 30) return 1 - suave((f - 26) / 4)
  return 0
}

let ultimo = 0, negraAnt = -1
update = () => {
  const dt = Math.min(0.1, Math.max(0, time - ultimo)); ultimo = time
  const n = Math.floor(nb()), golpe = n !== negraAnt; negraAnt = n
  const o = orden()
  const vez = Math.floor(nb() / CICLO)
  // organizados, las bandas respiran con cada negra
  const respira = 0.55 + 0.25 * Math.exp(-frac(nb()) * 4)
  const r0 = [], r1 = []
  gente.forEach((p, i) => {
    // vida libre
    if (golpe && !p.calmo) {
      if (azar(i, n) < 0.35) { p.vx *= -1; p.vy *= -1 }       // los histriónicos cambian de idea
      p.kick = 1
    }
    p.kick *= Math.exp(-dt * 8)
    p.x = mod(p.x + p.vx * dt + 0.2, 1.4) - 0.2
    p.y = mod(p.y + p.vy * dt + 0.1, 1.2) - 0.1
    const k = 1 + p.kick * 0.6
    const libre = [p.x, p.y, p.w * k, p.h / k]
    // su lugar en las bandas (con escalones que cambian cada vez que se organizan)
    const alto = 1 / BANDAS
    const lugar = [
      (p.tramo + 0.5) / TRAMOS,
      (p.banda + 0.5) * alto + (azar(p.tramo, vez * 7 + p.banda) - 0.5) * ESCALON,
      1 / TRAMOS + 0.002,
      alto * respira,
    ]
    const e = o
    const r = libre.map((v, j) => v + (lugar[j] - v) * e)
    ;(p.funde ? r1 : r0).push(r)
  })
  pintarDiff(g0, r0)
  pintarFusion(g1, r1, HALO)
}

salida().out(o0)
render(o0)
