// ============================================================
// 04_James_v02.js  ·  produccion/04_James/sketches/
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      El motor vive en produccion/04_James/arq/GP_04_James__visual.js (v2.0)
// Actualizado: 17/10/2026 (v02: formas puras en blanco y negro, 5 escenas
//              tomadas de los ejemplos de diseño. Los 13 estados salen del
//              análisis del audio — ver produccion/04_James/ensayo/)
// ============================================================
//
// Ensayo sin músicos: en el panel de GP_tools cargá
//   midi  → produccion/04_James/ensayo/04_James_ensayo_interpretado_midi.json
//   audio → James_-_MST_V3.mp3
// y antes de dar ▶: GP.estados.reiniciar() en la consola (o reevaluá en el inicio).

// ---- carga de scripts ----
// 'main' = ensayo: trae lo último que subiste, directo de GitHub (sin purgar).
//          Después de cada push: recargá Hydra y volvé a evaluar.
// Para el show: pegá el hash completo del commit probado
//          (GitHub Desktop → History → clic derecho → Copy SHA).
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

await cargarGP('LIVE/arq/GP_midi.js')               // Akai: faders, botones, filas, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')              // SÓLO ENSAYO: grabador (89), panel, reproductor → en el show, borrá esta línea
await cargarGP('LIVE/arq/GP_estados.js')            // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('produccion/04_James/arq/GP_04_James__visual.js')   // motor de formas puras

if (GP.tools) { GP.tools.init({ cancion: '04_James' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.james


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Es también el "inicio" (antes de la primera nota del canal 16):
// tamaño 0 = pantalla negra hasta que arranca el tema.
// Se puede cambiar en vivo: V.C.durMorfo = 1 + Ctrl+Enter
// ============================================================
V.init({
  escena: 'morfo',        // 'morfo' | 'iris' | 'corte' | 'anidado' | 'lente'

  // qué voz hace qué: 'bajo' | 'melodia' | 'bombo' | 'caja' | 'ninguna'
  cambio: 'bajo',         // pasa a la forma siguiente (la transición)
  golpe: 'bombo',         // hace latir la forma
  invierte: 'ninguna',    // invierte toda la pantalla con cada nota

  // faders (0 a 1 · 0.5 = normal)
  tamano: 0,              // F1 · 0 = no se ve nada · 1 = el doble
  tiempo: 0.5,            // F2 · duración de las transiciones · 0 = corte seco
  giro: 0.5,              // F3 · cuánto giran en cada cambio
  latido: 0.5,            // F4 · cuánto laten con el golpe

  // toggles
  negativo: false,        // N11 · todo invertido
  quieto: false,          // N12 · congela las formas (ignora la voz de 'cambio')
  separacion: 0.25,       // segundos mínimos entre dos cambios (el bajo a veces repite la nota muy junta)

  // ajustes finos de cada escena (los mismos nombres que en los ejemplos)
  tamMorfo: 0.42, durMorfo: 0.6, giroMorfo: 90, popMorfo: 0.12,
  durIris: 2.4, giroIris: 90, finalIris: 3.5,
  tamCorte: 0.45, durCorte: 0.7, franjas: 8, separa: 0.25, popCorte: 0.08,
  tamAnidado: 0.8, durAnidado: 0.8, giroAnidado: 30, adentro: 0.55, niveles: 10, popAnidado: 0.06,
  tamLente: 0.38, durLente: 0.6, lupa: 1.2, popLente: 1.5, columnas: 16, filasLente: 9,

  demo: false,            // true = notas falsas a demoBpm para probar sin MIDI
  demoBpm: 136,
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción.
// Mismo nombre que en V.init: los estados usan estos nombres.
// ============================================================
const CONTROLES = {
  tamano:   'F1',
  tiempo:   'F2',
  giro:     'F3',
  latido:   'F4',
  negativo: 'N11',
  quieto:   'N12',
}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Salen del análisis del audio (cambios de sección), con el tiempo
// en que llegan en el ensayo interpretado. 136 BPM.
// Cada estado anota sólo lo que cambia respecto de la BASE.
//   como: N   → arranca del estado N y le cambia lo que anota
//   fundido   → segundos que tarda en llegar (si no se anota: 0.3)
// La escena cambia seco, al entrar al estado.
// ============================================================
const ESTADOS = [
  /*  1 · 0:03 */ { nombre: 'arranca',         escena: 'morfo', tamano: 0.35, fundido: 1.5 },
  /*  2 · 0:10 */ { nombre: 'entra todo',      escena: 'morfo', tamano: 0.55, latido: 0.7 },
  /*  3 · 0:33 */ { nombre: 'corte',           escena: 'corte', tamano: 0.5 },
  /*  4 · 0:47 */ { nombre: 'iris',            escena: 'iris' },
  /*  5 · 1:02 */ { nombre: 'anidado',         escena: 'anidado', tamano: 0.5, latido: 0.7 },
  /*  6 · 1:23 */ { nombre: 'corte con caja',  como: 3, invierte: 'caja', tamano: 0.6 },
  /*  7 · 1:37 */ { nombre: 'lente',           escena: 'lente', tamano: 0.5, latido: 0.7 },
  /*  8 · 1:59 */ { nombre: 'respira',         escena: 'iris', tiempo: 0.9, giro: 0.25 },   // sin bombo: iris lento
  /*  9 · 2:18 */ { nombre: 'pico',            escena: 'anidado', tamano: 0.6, tiempo: 0.35, invierte: 'caja', latido: 0.9 },
  /* 10 · 2:52 */ { nombre: 'quiebre',         escena: 'morfo', tamano: 0.3, negativo: true, cambio: 'melodia', golpe: 'ninguna', tiempo: 0.8 },
  /* 11 · 3:10 */ { nombre: 'lente melodía',   escena: 'lente', tamano: 0.45, cambio: 'melodia', golpe: 'bombo' },
  /* 12 · 3:24 */ { nombre: 'iris caja',       escena: 'iris', cambio: 'caja', tiempo: 0.4, giro: 0.7 },
  /* 13 · 3:38 */ { nombre: 'final',           escena: 'morfo', tamano: 0.15, cambio: 'bajo', golpe: 'ninguna', tiempo: 1, fundido: 6 },
]


// ============================================================
// AKAI — mapa LIVE (mismo orden de canales que las otras canciones)
//   fila 8 → canal 1, bajo. Tocás un pad = una nota de bajo (grave a la izquierda). Mute: 82
//   fila 7 → canal 10, batería (36 bombo · 38 caja). A mano: col 1-4 bombo · col 5-8 caja. Mute: 83
//   fila 6 → canal 2, melodía. Tocás un pad = una nota de melodía. Mute: 84
//   fila 5 → a mano: col 1-5 = escena morfo · iris · corte · anidado · lente (hasta el próximo estado)
//            col 6 = golpe · col 7 = invierte · col 8 = cambio (pasa a la forma siguiente)
//   F1 tamaño · F2 tiempo de las transiciones · F3 giro · F4 latido
//   N11 negativo · N12 quieto (congela las formas)
//   86 / 87 = estado anterior / siguiente (ensayo o emergencia)
//   98 (Shift) = ocultar código y paneles · 89 = grabador · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11', 'N12'])
GP.midi.filas({
  8: { canal: 1,  rango: [31, 38] },     // rango sacado del audio
  7: { canal: 10, pulso: 'vuelta' },
  6: { canal: 2,  rango: [64, 88] },
  5: {},                                  // sólo a mano
})
const PIEZA = ['bombo', 'bombo', 'bombo', 'bombo', 'caja', 'caja', 'caja', 'caja']
const FILA5 = ['morfo', 'iris', 'corte', 'anidado', 'lente', 'golpe', 'invierte', 'cambio']

// los estados van después de V.init, de los botones y de las filas
GP.estados.init({
  cancion: '04_James',
  destino: V.C,
  controles: CONTROLES,
  estados: ESTADOS,
  alEntrar: () => V.alEntrarEstado(),   // la inversión por la caja arranca de cero en cada estado
})

GP.midi.alDisparo(({ fila, columna, nota, vel, on, origen }) => {
  if (fila === 8) { V.nota('bajo', nota, vel, on); return }
  if (fila === 6) { V.nota('melodia', nota, vel, on); return }
  if (fila === 7) {
    const pieza = origen === 'canal' ? (nota === 38 || nota === 40 ? 'caja' : 'bombo') : PIEZA[columna]
    V.nota(pieza, nota, vel, on)
    return
  }
  if (fila === 5 && on) V.mano(FILA5[columna])
})

// botones sueltos del Akai
GP.midi.alMensaje((nombre, data) => {
  const [st, nota, vel] = data
  if ((st & 0xf0) !== 0x90 || vel === 0 || !/apc|akai/i.test(nombre)) return
  if (nota === 98) V.toggleCodigo()
})


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0)
render(o0)
