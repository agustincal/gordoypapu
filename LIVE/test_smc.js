// ============================================================
// test_smc
// Prueba de la M-VAVE SMC-Mixer: ¿qué luces se pueden prender desde Hydra?
// No usa GP_midi ni GP_tools (no hace falta tener el Akai conectado).
// Actualizado: 2026-10-30 (v4: buscarLed() · v3: abre las entradas de verdad · v2: la caja queda fuera del body, así Hydra no la borra · muestra errores y todo lo que entra)
//
// Cómo usarlo:
//   1. Evaluá todo (Ctrl+Shift+Enter).
//   2. Tocá un botón de la SMC: su luz pasa por varios valores, y la caja
//      de arriba a la izquierda dice cuál está probando. Anotá qué ves.
//   3. Girá una perilla: si tiene anillo de luces, se mueve con ella.
//   4. pruebaTodo() en la consola: recorre todos los botones solo, uno por uno.
//   5. buscarLed(): recorre notas, medidores y CC por si alguno prende el LED suelto
//      (el de entre faders y perillas). Anotá el número que dice la caja cuando se prenda.
//   6. pruebaFader(1): manda el fader 1 arriba y abajo (por si es motorizado).
//   7. Si nada se prende: salidas() lista las salidas, y usarSalida(1)
//      prueba sólo con la segunda (Windows muestra la SMC dos veces).
// ============================================================

// botones que mandó la SMC en la grabación (de arriba a abajo, de izquierda a derecha)
const SMC_FILAS = [
  [24, 25, 26, 27, 28, 29, 30, 31],   // fila 1 (arriba)
  [0, 1, 2, 3, 4, 5, 6, 7],           // fila 2
  [8, 9, 10, 11, 12, 13, 14, 15],     // fila 3
  [16, 17, 18, 19, 20, 21, 22, 23],   // fila 4 (abajo)
]
const SMC_LINEA = [
  [94, 'play'], [93, 'pausa'], [95, 'stop'], [91, 'anterior'], [92, 'siguiente'],
  [46, 'retroceder'], [47, 'adelantar'], [96, 'arriba'], [97, 'abajo'], [98, 'izquierda'], [99, 'derecha'],
]
// valores que se prueban en cada luz (en el protocolo Mackie: 127 = prendido · 1 = parpadeo · 0 = apagado).
// Los del medio son por si la controladora usa el valor para elegir color.
const PASOS = [
  [127, 'prendido (127)'], [1, 'parpadeo (1)'], [2, 'valor 2'], [3, 'valor 3'], [5, 'valor 5'],
  [16, 'valor 16'], [32, 'valor 32'], [64, 'valor 64'], [0, 'apagado (0)'],
]
const MS_PASO = 900

// ---- caja en pantalla ----
const caja = document.getElementById('smcTest') || document.createElement('div')
caja.id = 'smcTest'
caja.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;background:rgba(0,0,0,.8);color:#ddd;font:13px/1.5 monospace;padding:8px 12px;border-radius:4px;max-width:560px;white-space:pre-wrap'
// fuera del <body>: el editor de Hydra re-dibuja el body y se llevaba la caja
document.documentElement.appendChild(caja)
if (window._smcObs) window._smcObs.disconnect()
window._smcObs = new MutationObserver(() => { if (!caja.isConnected) document.documentElement.appendChild(caja) })
window._smcObs.observe(document.documentElement, { childList: true })
caja.textContent = 'SMC · pidiendo acceso MIDI…'
const nombreDe = n => {
  for (let f = 0; f < 4; f++) { const c = SMC_FILAS[f].indexOf(n); if (c >= 0) return `fila ${f + 1} · botón ${c + 1}` }
  const l = SMC_LINEA.find(x => x[0] === n)
  return l ? `línea · ${l[1]}` : `nota ${n}`
}
let lineas = []
const mostrar = (txt) => {
  lineas.unshift(txt); lineas = lineas.slice(0, 8)
  let cab = 'SMC'
  try {
    cab = `entradas: ${[...acc.inputs.values()].map(i => i.name).join(' · ') || 'ninguna'}\n` +
          `salidas: ${[...acc.outputs.values()].map(o => o.name).join(' · ') || 'ninguna'}\n` +
          `mando las luces a: ${salidasUsadas().map(o => o.name).join(' + ') || 'NINGUNA'}`
  } catch (_) {}
  caja.textContent = cab + '\n\n' + lineas.join('\n')
  console.log('[SMC]', txt)
}

// ---- MIDI ----
const esSMC = n => /smc/i.test(n)
let acc
try {
  window._smcAcc = window._smcAcc || await navigator.requestMIDIAccess({ sysex: false })
  acc = window._smcAcc
} catch (err) {
  caja.textContent = `SMC · no pude abrir el MIDI: ${err.message}`
  throw err
}
let soloSalida = null
const todasSalidas = () => [...acc.outputs.values()].filter(o => esSMC(o.name))
const salidasUsadas = () => soloSalida == null ? todasSalidas() : todasSalidas().slice(soloSalida, soloSalida + 1)
const mandar = (bytes) => salidasUsadas().forEach(o => { try { o.send(bytes) } catch (e) { console.warn(o.name, e) } })

window.salidas = () => { todasSalidas().forEach((o, i) => console.log(i, o.name)); return todasSalidas().map(o => o.name) }
window.usarSalida = (i = null) => { soloSalida = i; mostrar(i == null ? 'usando todas las salidas' : `usando sólo la salida ${i}: ${salidasUsadas()[0]?.name}`) }

// ---- probar una luz ----
const timers = {}
const probarLuz = (nota) => {
  clearTimeout(timers[nota])
  let i = 0
  const paso = () => {
    const [v, txt] = PASOS[i]
    mandar([0x90, nota, v])
    mostrar(`${nombreDe(nota)} (nota ${nota}) → ${txt}`)
    if (++i < PASOS.length) timers[nota] = setTimeout(paso, MS_PASO)
  }
  paso()
}

// anillo de la perilla (Mackie: CC 48..55, valor = modo * 16 + posición 1..11)
const anillo = {}
const moverAnillo = (i, dir) => {
  anillo[i] = Math.max(0, Math.min(11, (anillo[i] ?? 0) + dir))
  mandar([0xb0, 48 + i, anillo[i]])
  mostrar(`perilla ${i + 1} → anillo en ${anillo[i]} de 11 (CC ${48 + i})`)
}

// ---- entradas: escucho las dos (Windows la muestra dos veces) y descarto el duplicado ----
const entradas = [...acc.inputs.values()].filter(i => esSMC(i.name))
let ultimo = { k: '', t: 0 }
const alMensaje = (ev) => {
  const data = ev.data
  const k = [...data].join(' ')
  if (k === ultimo.k && ev.timeStamp - ultimo.t < 15) return   // el mismo mensaje por el otro puerto
  ultimo = { k, t: ev.timeStamp }
  const [st, d1, d2] = data
  const tipo = st & 0xf0
  try {
    if (tipo === 0x90 && d2 > 0) probarLuz(d1)
    else if (tipo === 0xb0 && d1 >= 16 && d1 <= 23) moverAnillo(d1 - 16, d2 < 64 ? 1 : -1)
    else if (tipo === 0x90 || tipo === 0x80 || tipo === 0xe0) { /* soltar / fader: nada */ }
    else mostrar(`otro mensaje: ${k}`)
  } catch (err) { mostrar(`ERROR: ${err.message}`) }
}
// onmidimessage (no addEventListener): así Chrome abre el puerto solo
if (window._smcOyente) window._smcOyente.forEach(i => { i.onmidimessage = null })
window._smcOyente = entradas
entradas.forEach(i => {
  i.onmidimessage = alMensaje
  if (i.open) i.open().then(() => mostrar(`abierto: ${i.name} (${i.connection})`)).catch(err => mostrar(`no pude abrir ${i.name}: ${err.message}`))
})
if (entradas.length) mostrar(`escuchando: ${entradas.map(i => i.name).join(' + ')} · tocá un botón o girá una perilla`)
else mostrar('no encuentro la SMC: ¿está conectada? (reiniciá Chrome si la enchufaste recién)')

// ---- recorrido automático ----
window.pruebaTodo = async () => {
  const notas = [...SMC_FILAS.flat(), ...SMC_LINEA.map(x => x[0])]
  for (const n of notas) {
    mandar([0x90, n, 127]); mostrar(`${nombreDe(n)} (nota ${n}) → prendido`)
    await new Promise(r => setTimeout(r, 350))
    mandar([0x90, n, 0])
  }
  mostrar('fin del recorrido')
}
window.apagarTodo = () => { [...SMC_FILAS.flat(), ...SMC_LINEA.map(x => x[0])].forEach(n => mandar([0x90, n, 0])); for (let i = 0; i < 8; i++) mandar([0xb0, 48 + i, 0]) }

// buscar el LED suelto (entre los faders y las perillas): prueba todo lo que podría prenderlo.
// Mirá la caja: cuando se prenda, anotá el último número que dice.
const espera = ms => new Promise(r => setTimeout(r, ms))
window.buscarLed = async (ms = 400) => {
  const conocidas = new Set([...SMC_FILAS.flat(), ...SMC_LINEA.map(x => x[0])])
  // 1. notas que no son botones conocidos
  for (let n = 0; n < 128; n++) {
    if (conocidas.has(n)) continue
    mandar([0x90, n, 127]); mostrar(`buscando · nota ${n} prendida`)
    await espera(ms); mandar([0x90, n, 0])
  }
  // 2. medidores Mackie (presión de canal: canal de la tira * 16 + nivel)
  for (let t = 0; t < 8; t++) {
    mandar([0xd0, t * 16 + 12]); mostrar(`buscando · medidor de la tira ${t + 1} al máximo`)
    await espera(ms)
  }
  // 3. control changes
  for (let cc = 0; cc < 128; cc++) {
    mandar([0xb0, cc, 127]); mostrar(`buscando · CC ${cc} en 127`)
    await espera(ms / 2); mandar([0xb0, cc, 0])
  }
  mostrar('fin de la búsqueda')
}

// fader motorizado: pitch bend del canal del fader (0 abajo · 16383 arriba)
window.pruebaFader = async (n = 1) => {
  const ch = (n - 1) & 15
  for (const v of [16383, 0, 8192, 0]) {
    mandar([0xe0 | ch, v & 127, v >> 7]); mostrar(`fader ${n} → ${v === 16383 ? 'arriba' : v === 0 ? 'abajo' : 'al medio'}`)
    await new Promise(r => setTimeout(r, 1000))
  }
}

// algo de fondo para ver que Hydra corre
solid(0.05, 0.05, 0.08).out()
