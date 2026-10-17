// ============================================================
// 04_James_ej06_lente.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · ejemplo de diseño 6 de 6: Lente
// Idea: una lente con forma desplaza una grilla de cuadrados (lupa) y la invierte.
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
const COLUMNAS = 16, FILAS = 9   // grilla de fondo (16 x 9 = celdas cuadradas en 16:9)
const TAM = 0.38          // tamaño de la lente
const LUPA = 1.2          // cuánto agranda la lente en el centro (con degradado: bulto de lupa)
const POP = 1.5           // cuánto más agranda al llegar la nota
const DUR = 0.6           // segundos que tarda en moverse y transformarse
const POS = [[0.5, 0.5], [0.33, 0.58], [0.66, 0.42], [0.45, 0.38]]   // por dónde pasa la lente (x, y de 0 a 1)

// Fondo: una grilla de cuadrados. Una lente (triángulo, cuadrado o círculo)
// la desplaza: en el centro de la lente la grilla se ve más grande, como una
// lupa (acá sí hay degradado, pero sólo en el desplazamiento, no en la imagen).
// Además la lente invierte lo que tiene abajo (diff).
// Con cada nota la lente se transforma en la forma siguiente, se mueve y late.
const p = () => paso(DUR)
const lugar = eje => {
  const i = Math.floor(p()), f = p() % 1
  const a = POS[mod(i, POS.length)][eje], b = POS[mod(i + 1, POS.length)][eje]
  return a + (b - a) * f
}
const dx = () => 0.5 - lugar(0), dy = () => 0.5 - lugar(1)
const lados = d => () => LADOS[mod(Math.floor(p()) + d, 3)]
const campo = d => () => 2 * TAM * PESO[mod(Math.floor(p()) + d, 3)]

// campo de la lente, centrado: blanco en el medio, se apaga hacia el borde (mapa de desplazamiento)
const campoLente = () => shape(lados(0), 0, campo(0)).blend(shape(lados(1), 0, campo(1)), () => p() % 1).scale(1, ASP, 1)
// la misma lente con borde duro y en su lugar (es la que se ve)
const lente = campoLente().thresh(0.5, 0.004).scrollX(dx).scrollY(dy)

shape(4, 0.5, 0.02)
  .repeat(COLUMNAS, FILAS)
  .scrollX(() => -dx()).scrollY(() => -dy())              // lleva el centro de la lente al medio,
  .modulateScale(campoLente(), () => LUPA + POP * golpe(0.2))   // agranda desde el medio,
  .scrollX(dx).scrollY(dy)                                // y la devuelve a su lugar
  .diff(lente)
  .out(o0)

render(o0)
