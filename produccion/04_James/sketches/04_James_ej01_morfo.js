// ============================================================
// 04_James_ej01_morfo.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · ejemplo de diseño 1 de 6: Morfo
// Idea: una sola forma que se derrite en la siguiente: triángulo → cuadrado → círculo.
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
const TAM = 0.42          // tamaño (radio del círculo; 1 = media pantalla de alto)
const DUR = 0.6           // segundos que tarda en transformarse
const GIRO = 90           // grados que gira en cada transformación
const POP = 0.12          // cuánto salta de tamaño al llegar la nota

// Cada forma es un "campo": blanco en el centro y se apaga hacia afuera.
// Mezclar el campo de una forma con el de la siguiente y cortar en la mitad
// (thresh) da una sola forma, de borde duro, que se derrite en la otra.
const p = () => paso(DUR)                                  // 2.3 = 30% del camino de la forma 2 a la 3
const lados = k => () => LADOS[mod(Math.floor(p()) + k, 3)]
const campo = k => () => 2 * TAM * PESO[mod(Math.floor(p()) + k, 3)]

shape(lados(0), 0, campo(0))
  .blend(shape(lados(1), 0, campo(1)), () => p() % 1)
  .thresh(0.5, 0.004)
  .rotate(() => p() * GIRO * GRADOS)
  .scale(() => 1 + POP * golpe(0.12))
  .scale(1, ASP, 1)
  .out(o0)

render(o0)
