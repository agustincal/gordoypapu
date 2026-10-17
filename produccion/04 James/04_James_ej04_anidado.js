// ============================================================
// 04_James_ej04_anidado.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · ejemplo de diseño 4 de 6: Anidado
// Idea: formas una adentro de otra; cada nota hace zoom un nivel hacia adentro.
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
const ADENTRO = 0.55      // cada forma de adentro mide esto de la de afuera
const TAM = 0.8           // tamaño de la forma principal
const DUR = 0.8           // segundos que tarda en entrar un nivel
const GIRO = 30           // grados que gira cada nivel respecto del de afuera
const NIVELES = 10        // capas a la vez (las de más adentro son diminutas)

// Formas anidadas: triángulo, adentro un cuadrado, adentro un círculo, adentro
// un triángulo... alternando blanco y negro con diff. Cada nota hace zoom un
// nivel: la forma de adentro crece hasta ocupar el lugar de la de afuera.
const z = () => paso(DUR)
const nivel = j => {
  const m = () => Math.floor(z()) - 3 + j                  // qué nivel de la serie dibuja esta capa
  return shape(
      () => LADOS[mod(m(), 3)],
      () => TAM * PESO[mod(m(), 3)] * Math.pow(ADENTRO, m() - z()),
      0.004)
    .rotate(() => (m() - z()) * GIRO * GRADOS)
    .scale(1, ASP, 1)
}

// fondo: los niveles que ya quedaron afuera de la pantalla
const fondo = () => mod(Math.floor(z()) - 3, 2)

let imagen = solid(fondo, fondo, fondo)
for (let j = 0; j < NIVELES; j++) imagen = imagen.diff(nivel(j))
imagen.out(o0)

render(o0)
