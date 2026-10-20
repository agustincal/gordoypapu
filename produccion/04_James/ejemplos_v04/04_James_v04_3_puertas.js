// ============================================================
// 04_James_v04_3_puertas.js  ·  produccion/04_James/ejemplos_v04/
// Canción: 04_James (Gordo y Papu) · v04, ejemplo 3: Puertas
// Idea: paneles de alto completo que se tocan como teclas de piano: bajan rápido, se sostienen y se pliegan con peso hacia una línea; cada uno a su ritmo.
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
const PANELES = 12               // paneles en el ancho (de alto completo, algunos partidos)
const ATAQUE = 0.08              // negras que tarda en abrir (la tecla baja)
const SOLTAR = [0.8, 2.2]        // negras que tarda en plegarse (la tecla vuelve): de .. a
const SOSTIENE = [0.25, 1.5]     // negras que queda abierto: de .. a
const RITMOS = [2, 3, 4, 5, 6, 8] // cada panel se toca cada tantas negras (elige uno)
const LINEA = 0.0025             // la línea en la que termina el pliegue

// cada panel: dónde está, su ancho, hacia dónde se pliega, su ritmo, y si está partido en partes
const paneles = Array.from({ length: PANELES }, (_, i) => {
  const partes = azar(i, 1) < 0.6 ? 1 : azar(i, 1) < 0.85 ? 2 : 3
  return {
    x: (i + 0.2 + 0.6 * azar(i, 2)) / PANELES,             // repartidos en todo el ancho
    w: 0.03 + 0.28 * Math.pow(azar(i, 3), 1.5),
    ancla: [0, 0.5, 1][Math.floor(azar(i, 4) * 3)],
    cada: RITMOS[Math.floor(azar(i, 5) * RITMOS.length)],
    desfase: Math.floor(azar(i, 6) * 8),
    sostiene: SOSTIENE[0] + (SOSTIENE[1] - SOSTIENE[0]) * azar(i, 7),
    soltar: SOLTAR[0] + (SOLTAR[1] - SOLTAR[0]) * azar(i, 8),
    partes,
    // cada parte puede llegar un poco tarde (no siempre simultáneas)
    atrasos: Array.from({ length: partes }, (_, j) => j === 0 ? 0 : azar(i, 9 + j) * 0.75),
  }
})

// la tecla: baja rápido, se sostiene, vuelve con peso (rápido al principio, lento al final)
const tecla = (p, atraso) => {
  const t = nb() - atraso - p.desfase
  if (t < 0) return 0
  const k = t - Math.floor(t / p.cada) * p.cada            // negras desde la última vez que se tocó
  if (k < ATAQUE) return suave(k / ATAQUE)
  if (k < ATAQUE + p.sostiene) return 1
  const s = (k - ATAQUE - p.sostiene) / p.soltar
  return s < 1 ? Math.pow(1 - s, 2.2) : 0
}

update = () => {
  const r = []
  paneles.forEach(p => {
    for (let j = 0; j < p.partes; j++) {
      const a = tecla(p, p.atrasos[j])
      if (a <= 0) continue
      const w = Math.max(LINEA, p.w * a)
      const cx = p.x - p.w / 2 + p.w * p.ancla + (p.ancla === 0 ? w / 2 : p.ancla === 1 ? -w / 2 : 0)
      const h = 1 / p.partes
      r.push([cx, (j + 0.5) * h, w, h + 0.001])
    }
  })
  pintarDiff(g0, r)
  pintarFusion(g1, [], 1)
}

salida().out(o0)
render(o0)
