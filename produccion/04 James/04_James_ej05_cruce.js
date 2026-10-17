// ============================================================
// 04_James_ej05_cruce.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · ejemplo de diseño 5 de 6: Cruce
// Idea: tres formas que se cruzan con diff, se mueven de pose en pose y se transforman.
// Sólo blanco y negro, sólo triángulos, cuadrados y círculos.
// Se pega solo en el editor de Hydra (sin MIDI, sin tools): Ctrl+Shift+Enter.
// Actualizado: 17/10/2026
// ============================================================

// ---- reloj de prueba: hace de "nota" hasta que conectemos el MIDI ----
// (con el MIDI, cada nota real va a llamar a nuevaNota)
const BPM = 100
const CADA = 2                                   // una nota cada 2 negras
const T = { n: 0, t: [-99, -99, -99, -99] }      // cuántas notas van · cuándo llegaron (la última primero)
const nuevaNota = () => { T.n++; T.t.unshift(time); T.t.length = 4 }
let tic = -1
update = () => {
  const p = Math.floor(time * BPM / 60 / CADA)
  if (p !== tic) { tic = p; nuevaNota() }
}

// ---- ayudas ----
const desde = (k = 0) => time - T.t[k]                              // segundos desde la nota k (0 = la última)
const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2
const paso = dur => T.n - 1 + suave(desde() / dur)                  // sube de a 1 con cada nota, en 'dur' segundos
const golpe = caida => Math.exp(-desde() / caida)                   // 1 cuando llega la nota, se apaga en 'caida' s
const mod = (a, n) => ((a % n) + n) % n
const ASP = () => height / width                                    // para que un cuadrado sea cuadrado en pantalla ancha
const LADOS = [3, 4, 100]                                           // triángulo, cuadrado, círculo
const PESO = [0.78, 0.89, 1]                                        // triángulo y cuadrado más chicos: mismo peso visual que el círculo
const GRADOS = Math.PI / 180

// ---- ajustes ----
const DUR = 0.7           // segundos que tarda en pasar de una pose a la otra
const GIROS = [90, -90, 60]   // grados que gira cada forma en cada nota

// Tres formas superpuestas con diff: donde se cruzan, se invierten.
// Con cada nota se mueven a la próxima pose y cada una se transforma en la
// forma siguiente (triángulo → cuadrado → círculo).
// Pose: [x, y, tamaño] de cada forma. x, y de 0 a 1 (0.5 = centro).
const POSES = [
  [[0.38, 0.5, 0.42], [0.62, 0.5, 0.42], [0.5, 0.5, 0.2]],
  [[0.5, 0.4, 0.34], [0.5, 0.6, 0.34], [0.5, 0.5, 0.62]],
  [[0.3, 0.5, 0.6],  [0.72, 0.5, 0.26], [0.5, 0.5, 0.36]],
  [[0.5, 0.5, 0.75], [0.5, 0.5, 0.5],  [0.5, 0.5, 0.25]],
]

const p = () => paso(DUR)
const pose = (k, eje) => {
  const i = Math.floor(p()), f = p() % 1
  const a = POSES[mod(i, POSES.length)][k][eje]
  const b = POSES[mod(i + 1, POSES.length)][k][eje]
  return a + (b - a) * f
}
const forma = k => {
  const lados = d => () => LADOS[mod(Math.floor(p()) + k + d, 3)]
  const campo = d => () => 2 * pose(k, 2) * PESO[mod(Math.floor(p()) + k + d, 3)]
  return shape(lados(0), 0, campo(0))
    .blend(shape(lados(1), 0, campo(1)), () => p() % 1)
    .thresh(0.5, 0.004)
    .rotate(() => p() * GIROS[k] * GRADOS)
    .scale(1, ASP, 1)
    .scrollX(() => 0.5 - pose(k, 0))
    .scrollY(() => 0.5 - pose(k, 1))
}

forma(0).diff(forma(1)).diff(forma(2)).out(o0)

render(o0)
