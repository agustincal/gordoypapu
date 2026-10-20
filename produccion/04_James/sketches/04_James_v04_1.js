// ============================================================
// 04_James_v04_1.js  ·  produccion/04_James/sketches/  (DESARROLLO)
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      Usa GP_midi / GP_tools / GP_estados de LIVE/arq y el motor de desarrollo
//      produccion/04_James/arq/GP_04_James__visual_v04_1.js
// Actualizado: 20/10/2026 (v04_1: la v04 + variantes que se suman de a una.
//              Variante 1, PARTIDA: la puerta en pedazos que saltan con cada nota (N12).
//                probada en los estados 2, 6 y 12.
//              Variante 2, TÓTEM: se abre desde el lugar de la nota hacia los dos lados y se
//                recoge en dos agujas (N13). Probada en los estados 10 y 11.
//              Variante 3, RESPIRA: la franja crece de línea a llena y vuelve a línea (N14).
//                Probada en los estados 8 y 13.
//              Variante 4, STROBO QUE INVIERTE: ráfaga que invierte la pantalla entera en ritmo
//                rápido. Al entrar al pico (estado 9) y en el pad fila 5 col 4 (mientras apretás).
//                ⚠ Parpadeo rápido: avisar al público (fotosensibilidad).
//              La v04 sigue intacta en 04_James_v04.js)
// ============================================================
//
// Ensayo sin músicos: en el panel de GP_tools cargá
//   midi  → produccion/04_James/ensayo/04_James_ensayo_interpretado_midi.json
//   audio → produccion/04_James/ensayo/James - MST V3.mp3
// y antes de dar ▶: GP.estados.reiniciar() en la consola.

// ---- carga de scripts ----
// 'main' = ensayo: trae lo último que subiste, directo de GitHub (sin purgar).
//          Después de cada push: recargá Hydra (F5) y volvé a evaluar.
const GP_SHA = 'main'

const cargarGP = async (ruta) => {
  if (GP_SHA !== 'main') {
    await loadScript(`https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/${ruta}`)
    return
  }
  const url = `https://raw.githubusercontent.com/agustincal/gordoypapu/main/${ruta}?t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`no encontré ${ruta} (${res.status})`)
  ;(0, eval)(await res.text())
}

await cargarGP('LIVE/arq/GP_midi.js')                                // Akai: faders, botones, filas, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')                               // SÓLO ENSAYO: grabador (89), panel, reproductor
await cargarGP('LIVE/arq/GP_estados.js')                             // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('produccion/04_James/arq/GP_04_James__visual_v04_1.js') // motor de DESARROLLO

if (GP.tools) { GP.tools.init({ cancion: '04_James' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.james


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Es también el "inicio" (antes de la primera nota del canal 16): nada dispara, pantalla negra.
// Se puede cambiar en vivo: V.C.curva = 8 + Ctrl+Enter
// ============================================================
V.init({
  bpm: 136,                     // reloj propio, sólo si no llega clock MIDI

  // ---- quién hace qué (cada estado lo cambia) ----
  disparo: 'ninguna',           // voz que abre las puertas: 'bajo' | 'melodia' | 'bombo' | 'caja' | 'reloj' | 'ninguna'
                                //   bajo y melodía: la puerta queda abierta mientras suena la nota
                                //   bombo y caja: se abre, se sostiene un instante y se va
  cruce: 'ninguna',             // voz que dispara una segunda capa en sentido contrario (donde se pisan, se invierte)
  golpe: 'ninguna',             // voz que prende la pantalla entera y la cierra en barrido
  porAltura: false,             // N11 · cada nota prende sólo su franja (grave abajo); la batería, una al azar
  golpeAlCambiar: true,         // cada cambio de estado se marca con un golpe de pantalla entera
  rangos: { bajo: [31, 38], melodia: [64, 88] },   // del análisis del audio
  separacion: 0.25,             // negras: notas más pegadas que esto alargan la puerta en vez de cortarla
  direccion: 1,                 // 1 = se abren desde la izquierda · -1 = desde la derecha

  // ---- faders ----
  franjas: 3 / 7,               // F1 · 0 = 1 franja · 1 = 8 franjas (3/7 = 4)
  estela: 0.3,                  // F2 · 0 = borde duro · 1 = estela muy larga
  duracion: 0.5,                // F3 · duración del gesto: 0 = una negra · 0.5 = una blanca · 1 = una redonda
  durMin: 1, durMax: 4,         // negras con F3 abajo / arriba

  // ---- forma del gesto (proporciones: la duración real la da F3) ----
  abre: 4,                      // lo que tarda en abrir
  sostiene: 1,                  // lo que queda abierto (batería; bajo y melodía lo sostienen con la nota)
  sostieneMax: 4,               // lo máximo que una nota larga deja la puerta abierta (0 = sin límite)
  repite: 1,                    // si la nota sigue sonando, la puerta vuelve a entrar en la próxima negra
                                //   (0.5 = corchea · 2 = blanca · 0 = no vuelve)
  relevo: 0.15,                 // nota nueva con la puerta abierta: la que estaba se va y la nueva entra
                                //   un instante después (0 = pegadas · 0.3 = más negro entre las dos)
  cierra: 4,                    // lo que tarda en irse
  demora: 0.5,                  // demora máxima de cada franja (escalonado)
  curva: 6,                     // fuerza del ease in-out (3 suave · 6 pronunciado · 10 extremo)

  // ---- versiones: botón redondo arriba de cada fader (v1 → v2 → v3) ----
  verFranjas: 0,                // arriba de F1 · 0 parejas · 1 desparejas · 2 persiana
  verEstela: 0,                 // arriba de F2 · 0 degradado · 1 eco · 2 agujas
  verGesto: 0,                  // arriba de F3 · 0 desplazamiento · 1 ida y vuelta · 2 cruzado
  hueco: 0.35, escalones: 4, agujas: 7,

  // ---- variante 1: PARTIDA (N12) — la puerta en pedazos que saltan con cada disparo ----
  partida: false,
  celdas: 9,                    // pedazos a lo ancho de la pantalla
  huecos: 0.4,                  // proporción de pedazos que faltan
  separa: 0.12,                 // negro entre pedazos (fracción de celda)
  escalon: 0.25,                // cada pedazo un poco más arriba o abajo (0 = parejos)
  salto: 1,                     // celdas por disparo (pares a la derecha, impares a la izquierda)
  saltoDur: 0.35,               // negras que tarda el salto
  deriva: 0.05,                 // se deslizan solos (celdas por negra)

  // ---- variante 2: TÓTEM (N13) — se abre desde un punto hacia los dos lados y se recoge en dos agujas ----
  totem: false,
  totemLugar: 'altura',         // 'altura' (grave a la izquierda) · 'azar' · 'centro'
  totemAncho: 0.85,             // ancho máximo, los dos lados juntos
  dentado: 0.55,                // cuánto cambia el largo de cada franja (0 = parejo)
  totemHueco: 0.035,            // hueco del medio, entre las dos agujas

  // ---- variante 3: RESPIRA (N14) — la franja crece de línea a llena y vuelve a línea ----
  respira: false,
  respiraLinea: 0.5,            // dónde queda la línea en su franja: 0 = arriba · 0.5 = al medio · 1 = abajo

  // ---- variante 4: STROBO QUE INVIERTE — no pinta blanco: da vuelta la pantalla entera ----
  // ⚠ parpadeo rápido de pantalla entera: avisar al público (fotosensibilidad)
  stroboAlEntrar: 0,            // negras de ráfaga al entrar al estado (0 = no)
  stroboVoz: 'ninguna',         // voz que dispara una ráfaga con cada nota
  stroboDur: 1,                 // negras que dura cada ráfaga de stroboVoz
  stroboPaso: 0.125,            // negras entre inversiones: 0.125 = fusa · 0.25 = semicorchea · 0.5 = corchea

  // ---- golpe ----
  golpeSostiene: 0.25,          // negras que queda toda blanca
  golpeCierra: 1.5,             // negras que tarda el barrido en llevársela
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción.
// ============================================================
const CONTROLES = {
  franjas:    'F1',   // de 1 a 8 franjas
  estela:     'F2',   // de borde duro a estela larga
  duracion:   'F3',   // duración del gesto: de una negra a una redonda
  verFranjas: 'V1',   // parejas · desparejas · persiana
  verEstela:  'V2',   // degradado · eco · agujas
  verGesto:   'V3',   // desplazamiento · ida y vuelta · cruzado
  porAltura:  'N11',  // cada nota, su franja
  partida:    'N12',  // la puerta en pedazos
  totem:      'N13',  // se abre desde un punto, se recoge en dos agujas
  respira:    'N14',  // crece de línea a llena y vuelve a línea
}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Los 13 cortes del análisis del audio (136 BPM). Cada estado anota sólo lo que cambia
// respecto de la BASE. Cada cambio se marca con un golpe (golpeAlCambiar).
//   fundido → segundos que tarda en llegar (los números se funden; textos y versiones cambian al instante)
// Franjas: 0 = 1 · 1/7 = 2 · 3/7 = 4 · 5/7 = 6 · 6/7 = 7 · 1 = 8
// ============================================================
const ESTADOS = [
  /*  1 · 0:03 */ { nombre: 'arranca',        disparo: 'bajo', franjas: 0, estela: 0.4 },
                  //   una sola puerta, la pantalla entera: abre con cada nota del bajo y queda abierta mientras suena
  /*  2 · 0:10 */ { nombre: 'entra todo',     disparo: 'bajo', franjas: 3 / 7, cruce: 'caja', partida: true },
                  //   4 franjas escalonadas; la caja cruza en sentido contrario
  /*  3 · 0:33 */ { nombre: 'desparejas',     disparo: 'bajo', franjas: 5 / 7, verFranjas: 1, verEstela: 1, cruce: 'caja' },
  /*  4 · 0:47 */ { nombre: 'teclado',        disparo: 'bajo', porAltura: true, franjas: 1, verFranjas: 2, cruce: 'bombo' },
                  //   cada nota del bajo prende su franja (31 abajo … 38 arriba); el bombo cruza
  /*  5 · 1:02 */ { nombre: 'bombo',          disparo: 'bombo', duracion: 0.2, franjas: 6 / 7, verGesto: 1, cruce: 'bajo' },
                  //   el bombo toca puertas cortas (ida y vuelta); el bajo cruza largo
  /*  6 · 1:23 */ { nombre: 'cruzado',        disparo: 'bajo', verGesto: 2, franjas: 3 / 7, estela: 0.6,
                    partida: true, celdas: 6, huecos: 0.3, escalon: 0 },
                  //   las dos capas en pedazos que se corren en sentidos contrarios
  /*  7 · 1:37 */ { nombre: 'caja agujas',    disparo: 'caja', duracion: 0.15, franjas: 1, verFranjas: 1, verEstela: 2, cruce: 'bajo' },
  /*  8 · 1:59 */ { nombre: 'respira',        disparo: 'bajo', franjas: 2 / 7, duracion: 1, estela: 0.8, respira: true },
                  //   sin bombo: tres líneas a todo el ancho que se llenan con el bajo y vuelven a ser línea
  /*  9 · 2:18 */ { nombre: 'pico',           disparo: 'bajo', duracion: 0.25, franjas: 1, verFranjas: 2, verGesto: 2, repite: 0.5,
                    stroboAlEntrar: 2, golpeAlCambiar: false },
                  //   el bajo suena casi todo el tiempo: persiana cruzada que late en corcheas.
                  //   La entrada se marca con 2 negras de strobo que invierte (en vez del golpe)
  /* 10 · 2:52 */ { nombre: 'quiebre',        disparo: 'melodia', franjas: 1, verFranjas: 2, duracion: 0.6, estela: 0.5, totem: true },
                  //   tótem: cada nota de la melodía levanta una pila de 8 barras en su lugar (grave a la izquierda)
  /* 11 · 3:10 */ { nombre: 'quiebre 2',      disparo: 'melodia', franjas: 5 / 7, verEstela: 1, cruce: 'bajo',
                    totem: true, dentado: 0.8, duracion: 0.7 },
                  //   tótems de la melodía y del bajo; donde se pisan, se invierten
  /* 12 · 3:24 */ { nombre: 'caja',           disparo: 'caja', duracion: 0.1, franjas: 1, verFranjas: 1, verEstela: 2, cruce: 'melodia',
                    partida: true, celdas: 14, huecos: 0.55, escalon: 0.4 },
                  //   la caja abre pedazos chicos que saltan con cada golpe
  /* 13 · 3:38 */ { nombre: 'final',          disparo: 'bajo', franjas: 0, duracion: 1, estela: 1, fundido: 4, respira: true },
                  //   una sola línea en el medio de la pantalla que respira con el bajo
]


// ============================================================
// AKAI — mapa LIVE (una fila por canal)
//   fila 8 → canal 1, bajo (31–38). Tocás un pad = una nota de bajo (se sostiene mientras apretás). Mute: 82
//   fila 7 → canal 10, batería (36 bombo · 38 caja). A mano: col 1-4 bombo · col 5-8 caja. Mute: 83
//   fila 6 → canal 2, melodía (64–88). Tocás un pad = una nota de melodía. Mute: 84
//   fila 5 → a mano: col 1 = golpe (pantalla entera) · col 2 = una puerta (sin nota)
//            col 3 = los pedazos saltan (partida) · col 4 = strobo que invierte (mientras apretás)
//            col 5-8 libres
//   F1 franjas · F2 estela · F3 duración · botones arriba de F1/F2/F3 = versiones
//   N11 = cada nota, su franja · N12 = partida (la puerta en pedazos) · N13 = tótem · N14 = respira
//   86 / 87 = estado anterior / siguiente · 98 (Shift) = ocultar código y paneles
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11', 'N12', 'N13', 'N14'])
GP.midi.versiones({ F1: 3, F2: 3, F3: 3 })
GP.midi.filas({
  8: { canal: 1,  rango: [31, 38] },
  7: { canal: 10, pulso: 'vuelta' },
  6: { canal: 2,  rango: [64, 88] },
  5: {},      // sólo a mano
})

// los estados van después de V.init, de los botones, las versiones y las filas
GP.estados.init({
  cancion: '04_James',
  destino: V.C,
  controles: CONTROLES,
  estados: ESTADOS,
  alEntrar: (estado) => V.alEntrarEstado(estado),   // marca el corte (golpe y/o strobo)
})

GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  if (fila === 8) { V.nota('bajo', nota, vel, on); return }
  if (fila === 6) { V.nota('melodia', nota, vel, on); return }
  if (fila === 7) {
    if (!on) return
    const caja = origen === 'canal' ? (nota === 38 || nota === 40) : columna >= 4
    V.nota(caja ? 'caja' : 'bombo', nota, vel, true)
    return
  }
  if (fila === 5) {
    if (columna === 3) { V.mano('strobo', on); return }   // strobo: mientras apretás
    if (!on) return
    if (columna === 0) V.mano('golpe')
    if (columna === 1) V.mano('gesto')
    if (columna === 2) V.mano('salto')
  }
})

// todo lo que entra: el clock da el pulso; 98 oculta el código
GP.midi.alMensaje((nombre, data) => {
  V.midi(nombre, data)
  const [st, nota, vel] = data
  if ((st & 0xf0) === 0x90 && vel > 0 && /apc|akai/i.test(nombre) && nota === 98) V.toggleCodigo()
})


// ============================================================
// RENDER
// ============================================================
const VOZ_DE_FILA = { 8: 'bajo', 6: 'melodia' }
const muteAntes = {}
update = () => {
  // al mutear una fila, lo que quedó sonando de esa voz se suelta (si no, la puerta queda abierta)
  for (const [fila, voz] of Object.entries(VOZ_DE_FILA)) {
    const muteada = GP.midi.muteado(Number(fila))
    if (muteada && !muteAntes[fila]) V.soltarVoz(voz)
    muteAntes[fila] = muteada
  }
  V.update()
}

V.salida(o0)
render(o0)
