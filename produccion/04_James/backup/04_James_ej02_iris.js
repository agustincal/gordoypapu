// ============================================================
// 04_James_ej02_iris.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · ejemplo de diseño 2 de 6: Iris
// Idea: cada nota hace crecer una forma desde el centro que invierte todo (diff), capas sobre capas.
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
const CAPAS = 3           // formas creciendo a la vez (se superponen)
const DUR = 2.4           // segundos que tarda una forma en tapar la pantalla
const GIRO = 90           // grados que gira mientras crece
const FINAL = 3.5         // tamaño al terminar (3.5 = tapa la pantalla con margen)

// Cada nota hace nacer una forma en el centro que crece hasta tapar todo.
// Con diff, donde hay una forma se invierte lo que había abajo:
// blanco sobre negro, negro sobre blanco. Cuando tapa la pantalla, el fondo
// queda invertido y la próxima forma crece del color contrario.
const capa = k => {
  const prog = () => Math.max(0, desde(k) / DUR)
  return shape(
      () => LADOS[mod(T.n - k, 3)],
      () => T.n - k < 1 ? 0 : Math.pow(prog(), 1.4) * FINAL * PESO[mod(T.n - k, 3)],
      0.004)
    .rotate(() => prog() * GIRO * GRADOS * (mod(T.n - k, 2) ? 1 : -1))
    .scale(1, ASP, 1)
}

// fondo: las formas que ya taparon la pantalla y salieron de la lista
const fondo = () => mod(Math.max(0, T.n - CAPAS), 2)

let imagen = solid(fondo, fondo, fondo)
for (let k = 0; k < CAPAS; k++) imagen = imagen.diff(capa(k))
imagen.out(o0)

render(o0)
