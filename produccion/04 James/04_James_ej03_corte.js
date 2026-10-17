// ============================================================
// 04_James_ej03_corte.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · ejemplo de diseño 3 de 6: Corte
// Idea: la forma se corta en franjas que se separan (desplazamiento) y vuelve como la forma siguiente.
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
const TAM = 0.45          // tamaño de la forma
const FRANJAS = 8         // en cuántas franjas se corta
const SEPARA = 0.25       // cuánto se separan las franjas (0.25 = un cuarto de pantalla para cada lado)
const DUR = 0.7           // segundos que dura el corte

// Con cada nota la forma se corta en franjas que se separan para los dos lados
// (desplazamiento con un mapa de franjas). En el medio del corte, cuando las
// franjas están más separadas, cambia de forma; después vuelven a cerrarse.
// Una nota corta en franjas horizontales, la siguiente en verticales.
const corte = () => { const x = desde() / DUR; return x >= 1 ? 0 : Math.sin(Math.PI * x) }   // 0 → 1 → 0
const cual = () => mod(desde() / DUR < 0.5 ? T.n - 1 : T.n, 3)    // cambia de forma en el medio del corte
const acostado = () => T.n % 2 === 0

// mapas de desplazamiento: franjas que valen +0.5 y -0.5 (unas van para un lado, otras para el otro)
const franjasH = shape(2, 0.5, 0.001).repeat(1, FRANJAS).brightness(-0.5)
const franjasV = shape(2, 0.5, 0.001).rotate(Math.PI / 2).repeat(FRANJAS, 1).brightness(-0.5)

shape(() => LADOS[cual()], () => TAM * PESO[cual()], 0.004)
  .scale(1, ASP, 1)
  .modulateScrollX(franjasH, () => acostado() ? 2 * SEPARA * corte() : 0)
  .modulateScrollY(franjasV, () => acostado() ? 0 : 2 * SEPARA * corte())
  .out(o0)

render(o0)
