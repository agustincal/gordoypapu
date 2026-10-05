// ============================================================
// Canción nueva — 3 ambientes de exploración (sin control MIDI)
//   o0 = Círculos + strobe   (ref. 404.zero, ISOTRP) — v06: + fila Akai, golpe central, hue al azar
//   o1 = Planos de color     (ref. Point of No Return)
//   o2 = Horizonte           (piano de luz, líneas horizontales)
//
// Por ahora sólo se renderiza o0; o1 y o2 están ocultos (ver MOSTRAR_OTROS).
//
// Todas las perillas están en los objetos C, P y H. Casi todas se leen
// en cada frame, así que podés cambiar un valor en vivo evaluando
// una sola línea (Ctrl+Enter), ej:  C.radio = 0.4
// ============================================================

const clamp01 = v => Math.max(0, Math.min(1, v))
const aspecto = () => height / width   // corrige que las formas salgan estiradas en pantalla ancha


// ============================================================
// o0 — CÍRCULOS POR NOTA (v03: controlados por MIDI)
// Cada nota del canal de melodía hace entrar un círculo desde la
// izquierda o la derecha (al azar), que viaja hasta el centro y se
// desvanece como una nota que se va. Cada nota nueva trae otro círculo.
// ============================================================

// aro: igual que tu ring, pero con centro movible (cx, cy) y corregido
// para pantalla ancha. Así puede entrar desde afuera de la pantalla
// sin "envolver" como pasaba con scrollX.
setFunction({
  name: 'aro',
  type: 'src',
  inputs: [
    { type: 'float', name: 'cx',    default: 0.5 },
    { type: 'float', name: 'cy',    default: 0.5 },
    { type: 'float', name: 'radio', default: 0.2 },
    { type: 'float', name: 'borde', default: 0.06 },
    { type: 'float', name: 'hueco', default: 0.0 },
  ],
  glsl: `
    float asp = resolution.x / resolution.y;
    vec2 p = vec2((_st.x - 0.5) * asp + 0.5, _st.y);
    vec2 c = vec2((cx - 0.5) * asp + 0.5, cy);
    float d = distance(p, c);
    float afuera  = smoothstep(radio - borde, radio, d);
    float adentro = smoothstep(hueco - 0.02, hueco, d);
    float v = clamp(adentro - afuera, 0.0, 1.0);
    return vec4(vec3(v), 1.0);
  `
})

const C = {
  canal: 1,              // canal MIDI de la melodía (en el ensayo: canal 1)
  // tamaño según la nota: grave = grande, agudo = chico
  notaGrave: 36,         // nota más grave esperada (C2)
  notaAguda: 84,         // nota más aguda esperada (C6)
  radioGrave: 0.32,
  radioAgudo: 0.07,
  borde: 0.07,           // difuminado del borde
  // color: cada disparo toma un tono al azar cerca del tono base
  hue: 20,               // tono base en grados (0 = rojo, 20 = rojo-naranja, 40 = naranja)
  hueVar: 8,             // cuántos grados puede desviarse cada disparo (+/-)
  sat: 1,                // saturación (1 = puro)
  entrada: 0.35,         // segundos que tarda en llegar del borde al centro
  desdeX: 0.35,          // qué tan afuera arranca (0.35 = fuera de pantalla)
  ataque: 0.02,          // segundos en encenderse
  mantener: 0.5,         // segundos que se queda entero en el centro antes de irse
  release: 1.2,          // segundos en desvanecerse
  huecoAlIrse: 0.8,      // al desvanecerse se ahueca (0 = no, ~0.9 = aro finito)
  // escape: cada tanto uno se va volando para arriba en vez de apagarse
  escapeProb: 0.12,      // probabilidad por nota (0.12 = ~1 de cada 8)
  escapeDur: 0.6,        // segundos que tarda en salir de pantalla
  escapeDir: 1,          // 1 = arriba, -1 = abajo (si sale para el lado equivocado, invertir)
  // Akai: fila de disparo (8 pads)
  akaiPrimera: 56,       // nota del primer pad de la fila (56 = fila 8 del APC Mini)
  radioAkai: 0.22,       // tamaño de los círculos disparados desde el Akai
  // pad 4: gran golpe desde el centro
  golpeDur: 0.4,         // segundos que tarda en crecer hasta cubrir todo
  golpeRadio: 1.3,       // tamaño final (1.3 = más grande que la pantalla)
  golpeLuz: 1.8,         // cuánto más brillante que un círculo normal
  // fluctuación suave de la intensidad del color
  fluct: 0.25,           // cuánto baja la intensidad en el punto más bajo (0 = nada)
  fluctVel: 3,           // velocidad de la fluctuación
  // micrófono: la luz "tiembla"
  micPos: 0.06,          // cuánto se sacude la posición con la voz
  micLuz: 0.9,           // cuánto parpadea la intensidad (0..1)
  micTam: 0.25,          // cuánto late el tamaño
  micUmbral: 0.15,       // por debajo de esto el mic no hace nada (ruido de ambiente)
  // strobe rojo sincronizado (ojo fotosensibilidad en vivo)
  strobeClock: false,    // golpes siguiendo el clock MIDI con el patrón de abajo
  strobePatron: 'X.X.X...........', // X = golpe, . = nada (como la grilla de Buscando Placer)
  strobeRes: 3,          // ticks de clock por paso: 3 = fusa, 6 = semicorchea, 12 = corchea
  strobeBombo: true,     // además, un golpe en cada nota del canal de bombo
  canalBombo: 10,
  flashDur: 0.045,       // segundos que dura cada golpe (más chico = más seco)
  flashColor: [1, 0, 0],
  flashFuerza: 1,
  demo: false,           // true = notas + clock falsos para probar sin MIDI
}

const N = 8   // cuántos círculos pueden convivir a la vez (se reciclan)
const slots = Array.from({ length: N }, () => ({
  activo: false, lado: 1, t0: -99, sostenida: false, tSuelta: 0, nivelSuelta: 0,
  vel: 1, nota: -1, radio: 0.2, escapa: false, escapeDir: 1, tipo: 'normal',
  rgb: [1, 0.33, 0], luzMult: 1, fase: 0, jx: 0, jy: 0, jl: 1, jr: 1
}))

// tono (grados) → RGB
const hsvARgb = (h, sat) => {
  h = ((h % 360) + 360) % 360 / 60
  const i = Math.floor(h), f = h - i
  const p = 1 - sat, q = 1 - sat * f, t = 1 - sat * (1 - f)
  return [[1, t, p], [q, 1, p], [p, 1, t], [p, q, 1], [t, p, 1], [1, p, q]][i % 6]
}
let proximo = 0

const easeOut = t => 1 - Math.pow(1 - t, 3)
const easeIn = t => t * t * t

const radioDeNota = nota => {
  const t = clamp01((nota - C.notaGrave) / (C.notaAguda - C.notaGrave))
  return C.radioGrave + (C.radioAgudo - C.radioGrave) * t
}

// cuánto tarda en "llegar": viajar al centro, o crecer si es un golpe
const llegada = s => s.tipo === 'golpe' ? C.golpeDur : C.entrada

// momento en que el círculo empieza a irse (después de llegar + mantener)
const inicioCaida = s => Math.max(s.tSuelta, s.t0 + llegada(s)) + C.mantener

// nivel de luz: sube en el ataque, se mantiene mientras la nota está
// apretada, espera en el centro, y recién ahí cae (o se escapa entero)
const nivel = s => {
  if (!s.activo) return 0
  const subida = clamp01((time - s.t0) / C.ataque) * s.vel
  if (s.sostenida) return subida
  const t0c = inicioCaida(s)
  if (time < t0c) return s.nivelSuelta
  if (s.escapa) {
    if (time - t0c > C.escapeDur) s.activo = false
    return s.nivelSuelta
  }
  const n = s.nivelSuelta * Math.exp(-(time - t0c) / (C.release / 3))
  if (n < 0.005) s.activo = false
  return n
}

// posición X: del borde (izquierdo o derecho) al centro
const posX = s => {
  if (s.tipo === 'golpe') return 0.5
  const t = easeOut(clamp01((time - s.t0) / C.entrada))
  const inicio = 0.5 + s.lado * (0.5 + C.desdeX + s.radio)
  return inicio + (0.5 - inicio) * t
}

// posición Y: centro, salvo los que se escapan
const posY = s => {
  if (!s.escapa || s.sostenida) return 0.5
  const t = clamp01((time - inicioCaida(s)) / C.escapeDur)
  return 0.5 + s.escapeDir * easeIn(t) * (0.6 + s.radio)
}

// radio actual: fijo, salvo el golpe que crece desde el centro
const radioActual = s => s.tipo === 'golpe'
  ? s.radio * easeOut(clamp01((time - s.t0) / C.golpeDur))
  : s.radio

// opciones: lado (1 = entra por derecha, -1 = por izquierda), escapa,
// escapeDir, tipo ('normal' | 'golpe'), radio
const notaOn = (nota = 60, vel = 100, op = {}) => {
  const s = slots[proximo]
  proximo = (proximo + 1) % N
  s.activo = true
  s.lado = op.lado ?? (Math.random() < 0.5 ? -1 : 1)
  s.t0 = time
  s.sostenida = true
  s.vel = vel / 127
  s.nota = nota
  s.tipo = op.tipo ?? 'normal'
  s.radio = op.radio ?? radioDeNota(nota)
  s.escapa = op.escapa ?? (s.tipo === 'normal' && Math.random() < C.escapeProb)
  s.escapeDir = op.escapeDir ?? C.escapeDir
  s.luzMult = s.tipo === 'golpe' ? C.golpeLuz : 1
  s.rgb = hsvARgb(C.hue + (Math.random() * 2 - 1) * C.hueVar, C.sat)
  s.fase = Math.random() * 6.28
}

// fila de disparo del Akai: qué hace cada pad (los que no están, disparo normal)
const PADS_AKAI = [
  { lado: 1 },                               // 1: entra por la derecha
  { lado: -1 },                              // 2: entra por la izquierda
  { escapa: true, escapeDir: -1 },           // 3: se va para abajo
  { tipo: 'golpe', radio: C.golpeRadio },    // 4: gran golpe desde el centro
]
const padAkai = (pad, vel) => {
  const op = PADS_AKAI[pad] ?? {}
  notaOn(1000 + pad, vel, { radio: C.radioAkai, ...op })
}

const notaOff = (nota = 60) => {
  for (let k = 1; k <= N; k++) {
    const s = slots[(proximo - k + N) % N]
    if (s.activo && s.sostenida && s.nota === nota) {
      s.nivelSuelta = nivel(s)
      s.sostenida = false
      s.tSuelta = time
      return
    }
  }
}

// ---- strobe: golpes secos de luz roja sobre toda la pantalla ----
let tFlash = -99
const golpe = () => { tFlash = time }
const flash = () => Math.exp(-(time - tFlash) / (C.flashDur / 3)) * C.flashFuerza

// clock MIDI: 24 ticks por negra. Contamos ticks y en cada paso del
// patrón que tenga X, golpe. Se reinicia con el play (start) del DAW,
// así el patrón arranca siempre alineado al compás.
let ticks = 0
const tickClock = () => {
  if (C.strobeClock && ticks % C.strobeRes === 0) {
    const paso = Math.floor(ticks / C.strobeRes) % C.strobePatron.length
    if (C.strobePatron[paso] === 'X') golpe()
  }
  ticks++
}

window.circulos = { notaOn, notaOff, padAkai, golpe, C }   // para probar desde consola o reproductor

// ---- MIDI: melodía, bombo y clock ----
if (window._circulosMidi) window._circulosMidi.forEach(([inp, fn]) => inp.removeEventListener('midimessage', fn))
window._circulosMidi = []
navigator.requestMIDIAccess().then(acc => {
  acc.inputs.forEach(inp => {
    const fn = m => {
      const [st, nota, vel] = m.data
      if (st === 0xF8) { tickClock(); return }      // clock
      if (st === 0xFA) { ticks = 0; return }        // start: reinicia el patrón
      if (st >= 0xF0) return                        // continue, stop, etc.
      const tipo = st & 0xF0
      const canal = (st & 0x0F) + 1
      const on = tipo === 0x90 && vel > 0
      const off = tipo === 0x80 || (tipo === 0x90 && vel === 0)
      // Akai: sólo la fila de disparo; el resto del Akai se ignora acá
      if (/apc|akai/i.test(inp.name)) {
        const pad = nota - C.akaiPrimera
        if (pad < 0 || pad > 7) return
        if (on) padAkai(pad, 110)
        else if (off) notaOff(1000 + pad)
        return
      }
      if (canal === C.canalBombo) { if (on && C.strobeBombo) golpe(); return }
      if (canal !== C.canal) return
      if (on) notaOn(nota, vel)
      else if (off) notaOff(nota)
    }
    inp.addEventListener('midimessage', fn)
    window._circulosMidi.push([inp, fn])
  })
})

// ---- modo demo: notas, clock y bombo falsos a ~102 BPM ----
if (window._circulosDemo) window._circulosDemo.forEach(clearInterval)
window._circulosDemo = [
  setInterval(() => {
    if (!C.demo) return
    const nota = C.notaGrave + Math.floor(Math.random() * (C.notaAguda - C.notaGrave))
    notaOn(nota, 100)
    setTimeout(() => notaOff(nota), 72)
  }, 147),
  setInterval(() => { if (C.demo) tickClock() }, 24.5),
  setInterval(() => { if (C.demo && C.strobeBombo) golpe() }, 588),
]

// ---- micrófono ----
a.setBins(4)
a.setSmooth(0.4)     // bajo = reacciona rápido (más "temblor")
a.setScale(8)
a.setCutoff(0.1)
a.show()             // barras del mic en pantalla para calibrar; a.hide() para sacarlas

const voz = () => {
  const v = Math.min(1, Math.max(...a.fft))
  return v < C.micUmbral ? 0 : (v - C.micUmbral) / (1 - C.micUmbral)
}

// el temblor se sortea una vez por frame para cada círculo
update = () => {
  const v = voz()
  for (const s of slots) {
    s.jx = (Math.random() - 0.5) * 2 * v * C.micPos
    s.jy = (Math.random() - 0.5) * 2 * v * C.micPos
    s.jl = 1 - Math.random() * v * C.micLuz
    s.jr = 1 + (Math.random() - 0.5) * 2 * v * C.micTam
  }
}

// fluctuación suave del color, distinta para cada círculo
const fluct = s => 1 - C.fluct * (0.5 + 0.5 * Math.sin(time * C.fluctVel + s.fase) * Math.sin(time * C.fluctVel * 0.37 + s.fase * 2))

const circulo = i => {
  const s = slots[i]
  const luz = () => nivel(s) * s.jl * fluct(s) * s.luzMult
  return aro(
      () => posX(s) + s.jx,
      () => posY(s) + s.jy,
      () => radioActual(s) * s.jr,
      () => C.borde,
      () => s.radio * C.huecoAlIrse * (s.sostenida ? 0 : clamp01(1 - nivel(s) / Math.max(s.nivelSuelta, 0.001)))
    )
    .color(
      () => s.rgb[0] * luz(),
      () => s.rgb[1] * luz(),
      () => s.rgb[2] * luz()
    )
}

let circulos = solid(0, 0, 0)
for (let i = 0; i < N; i++) circulos = circulos.add(circulo(i))

circulos
  .add(solid(() => C.flashColor[0], () => C.flashColor[1], () => C.flashColor[2]), flash)
  .out(o0)


// ============================================================
// AMBIENTES OCULTOS POR AHORA — poner MOSTRAR_OTROS = true para
// volver a compilarlos (y cambiar render(o0) por render() abajo)
// ============================================================
const MOSTRAR_OTROS = false
if (MOSTRAR_OTROS) {

// ============================================================
// o1 — PLANOS DE COLOR
// ============================================================

const P = {
  lavanda: [0.62, 0.56, 0.95],
  rojo: [1, 0.2, 0.02],
  bandas: 5,             // franjas verticales dentro del plano lavanda
  contrasteBandas: 0.25, // diferencia de brillo entre franjas
  moire: 0.18,           // intensidad de las líneas finas
  moireDensidad: 260,    // cuántas líneas finas
  angVel: 0.05,          // giro del corte diagonal
  bordeVel: 0.07,        // desplazamiento del corte diagonal
  marcoVel: 0.06,        // el plano respira: de rectángulo flotante a pantalla llena
}

// plano lavanda con franjas verticales de brillo escalonado
const lavanda = () => gradient(0).r()
  .posterize(() => P.bandas, 1)
  .color(() => P.contrasteBandas, () => P.contrasteBandas, () => P.contrasteBandas)
  .add(solid(() => P.lavanda[0], () => P.lavanda[1], () => P.lavanda[2]))

// corte diagonal duro entre lavanda y rojo
const corte = () => gradient(0).g()
  .rotate(() => 0.25 + 0.2 * Math.sin(time * P.angVel))
  .thresh(() => 0.5 + 0.2 * Math.sin(time * P.bordeVel), 0.001)

// líneas finísimas apenas onduladas (el "vibrar" del color de cerca)
const moire = () => osc(() => P.moireDensidad, 0.005, 0)
  .rotate(Math.PI / 2)
  .modulate(osc(3, 0.02, 0), 0.015)

// marco: afuera queda negro
const marco = () => shape(4, 0.5, 0.001)
  .scale(() => 0.9 + 1.3 * (0.5 + 0.5 * Math.sin(time * P.marcoVel)))

solid(() => P.rojo[0], () => P.rojo[1], () => P.rojo[2])
  .layer(lavanda().mask(corte()))
  .mult(moire(), () => P.moire)
  .mult(marco())
  .out(o1)


// ============================================================
// o2 — HORIZONTE (piano de luz simulado)
// Cada "lámpara" es una línea horizontal: aparece a una altura (la nota),
// crece mientras se "sostiene" y se apaga. Sin MIDI, las notas se simulan
// con tiempos distintos por lámpara para que se superpongan.
// ============================================================

const H = {
  lamparas: 4,
  color: [1, 0.55, 0.3],
  grosorMin: 0.004,
  grosorMax: 0.08,
  halo: 0.35,       // brillo del resplandor alrededor de cada línea
  estela: 0.75,     // 0 = sin rastro, cerca de 1 = rastro largo
  melodia: [-0.3, -0.1, 0.05, 0.25, 0.1, -0.2, 0.35, 0],  // alturas (grave abajo, agudo arriba)
}

const periodo = i => 2.2 + i * 0.7
const fase = i => (time + i * 1.3) / periodo(i)

// envolvente: ataque rápido, se sostiene, se apaga
const env = i => {
  const t = fase(i) % 1
  return clamp01(t / 0.08) * clamp01((0.65 - t) / 0.25)
}
const altura = i => H.melodia[(Math.floor(fase(i)) * 3 + i) % H.melodia.length]

const linea = i => shape(4, 1, 0.001)
  .scale(1, 4, () => H.grosorMin + env(i) * H.grosorMax)
  .scrollY(() => altura(i))
  .color(() => H.color[0] * env(i), () => H.color[1] * env(i), () => H.color[2] * env(i))

const halo = i => shape(4, 0.5, 0.9)
  .scale(1, 4, () => (H.grosorMin + env(i) * H.grosorMax) * 6)
  .scrollY(() => altura(i))
  .color(
    () => H.color[0] * env(i) * H.halo,
    () => H.color[1] * env(i) * H.halo,
    () => H.color[2] * env(i) * H.halo
  )

let horizonte = solid(0.03, 0, 0)
for (let i = 0; i < H.lamparas; i++) {
  horizonte = horizonte.add(linea(i)).add(halo(i))
}

horizonte
  .blend(src(o2), () => H.estela)
  .out(o2)


} // fin de MOSTRAR_OTROS


// ============================================================
// o3 libre (reservado para "Respiración" más adelante)
// ============================================================

render(o0)