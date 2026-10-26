// ============================================================
// 02_Buscando_Placer_v05.js  ·  produccion/02_Buscando_Placer/sketches/  (COPIA DE TRABAJO)
// Canción: 02_Buscando_Placer (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      El motor de esta copia vive en produccion/02_Buscando_Placer/arq/GP_02_Buscando_Placer__visual.js (v3.4).
//      GP_midi, GP_tools y GP_estados se cargan de LIVE/arq, como siempre.
//      LIVE (sketch v02 + motor v3.0) no se toca hasta aprobar esta copia.
// Actualizado: 16/10/2026 (v01: primera versión LIVE. Los 13 estados son los
//              de produccion/02_Buscando_Placer_v03, pasados al formato nuevo)
//              20/10/2026: imágenes de assets/sequence02, 30 JPG numerados (IMAGENES_02); la 01 queda como IMAGENES_01
//              23/10/2026 (v02, después del ensayo del 22/10): el canal 9 pasa a la fila 5 (el 3 nunca llegó).
//              De base sólo dispara el canal 1 (bajo); 10, 2 y 9 quedan muteados hasta darles su propio efecto.
//              23/10/2026 (v04, producción, sobre LIVE v02): versiones por fader (botones 64-71) ·
//              imán ↔ mala señal (imán F7, mala señal F5) · F8 feedback · canal 2 / fila 6 = invertir ·
//              canal 9 / fila 5 = color · pixelado con curva pareja
//              23/10/2026 (motor v3.2): el imán es sólo F7, siempre activo; N12 queda libre
//              23/10/2026 (motor v3.3): F3 V2 = mosaico (fader: 0 nada → 1 hexágono)
//              23/10/2026: 7 estados de prueba (ESTADOS_PRUEBA) para el ensayo de 3:48; los 13 de la canción
//              quedan en ESTADOS_CANCION. Canales 2 y 9 muteados de base; se abren en las partes donde entran.
//              24/10/2026 (v05, motor v3.4): duración por nota — la aparición sigue a la nota sostenida y
//              termina según el ritmo · barrido según el ritmo · F6 con versiones de aparición (zoom / abre /
//              tele) · el golpe dura mientras suena la nota · F8 frena en silencio. LIVE sigue en v04.
//              24/10/2026 (motor v3.5): canal 2 / fila 6 = tirón de glitch (ya no invierte) · la mala señal
//              (vhs, rueda) no reacciona a los disparos del bajo
//              24/10/2026 (motor v3.6): F5 vhs y rueda rehechos con las referencias de TV / VHS
//              24/10/2026 (motor v3.7): F5 V1 saltos · V2 ondas que bajan · V3 rueda más lenta
//              25/10/2026 (motor v3.9): N18 = el collage se apaga hacia negro (1 s tocando, 0.3 s en silencio)
//              25/10/2026 (motor v3.10): recuadros negros (recuadrosNegros: base 0, cada estado pone el suyo)
//              25/10/2026: estados de prueba con lo nuevo — apagado (N18) en 2, 6 y 7 · negros por estado ·
//              intro con vhs suave (sin saltos) · saltos de F5 V1 en el 3 y el 7
//              26/10/2026 (motor v3.11, GP_midi v1.10): pads de 4 estados — N18 apagado (0 nada · 1 suave ·
//              2 normal · 3 extremo) · N28 recuadros negros (0 · 15 · 30 · 50 %). Shift + pad = atrás
//              26/10/2026 (motor v3.12): F6 sigue la duración del toque — al soltar, el recuadro queda del
//              tamaño al que llegó (aparicionQueda) · aparicionLarga 1.8 → 0.4 s
// ============================================================

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

await cargarGP('LIVE/arq/GP_midi.js')                        // Akai: faders, botones, filas, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')                       // SÓLO ENSAYO: grabador (89), panel, reproductor → en el show, borrá esta línea
await cargarGP('LIVE/arq/GP_estados.js')                     // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('produccion/02_Buscando_Placer/arq/GP_02_Buscando_Placer__visual.js')  // motor v3.1 (copia de trabajo)

if (GP.tools) { GP.tools.init({ cancion: '02_Buscando_Placer' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.buscandoPlacer


// ============================================================
// IMÁGENES / VIDEOS
// ============================================================
const MODO_FUENTE = 'imagen'   // 'imagen' | 'video'

// del mismo lugar que el código: 'main' = lo último · hash = ese commit
const ASSETS = GP_SHA === 'main'
  ? 'https://raw.githubusercontent.com/agustincal/gordoypapu/main/produccion/02_Buscando_Placer/assets/'
  : `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/produccion/02_Buscando_Placer/assets/`

const IMAGENES_01 = ['01', '02', '03', '04', '05', '06'].map(n => `${ASSETS}sequence01/${n}.jpg`)

// sequence02: 30 JPG numerados 01-30 (lado máx. 1024) en produccion/.../assets/sequence02
const IMAGENES_02 = Array.from({ length: 30 }, (_, i) => `${ASSETS}sequence02/${String(i + 1).padStart(2, '0')}.jpg`)

const IMAGENES = IMAGENES_02   // ← poné IMAGENES_01 para volver a la secuencia anterior
const VIDEOS = Array.from({ length: 20 }, (_, i) => `${ASSETS}videos01/Kim_chi_fied_rice_${String(i + 1).padStart(2, '0')}.mp4`)

V.medios({
  urls: MODO_FUENTE === 'video' ? VIDEOS : IMAGENES,
  modo: MODO_FUENTE,
  fuente: s1,
  aspecto: MODO_FUENTE === 'video' ? 720 / 1280 : 1,   // alto / ancho del material
})


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Faders de 0 a 1. Se puede cambiar en vivo: V.C.colorBase = 0.3 + Ctrl+Enter
// ============================================================
V.init({
  // faders
  jitter: 0,           // F1: distorsión / temblor del recuadro
  pixelado: 0.05,      // F2: pixelado. Fuerte: alto sólo en 1-2 momentos de la canción (curva nueva: revisar los estados 8 y 12)
  marco: 0,            // F3: tamaño del marco del recuadro (V2: además, mosaico en toda la pantalla: 0 nada → 1 hexágono)
  tinte: 0,            // F4: cuánto tiñe el color
  malaSenal: 0,        // F5: mala señal de TV (por defecto se toca a mano)
  zoom: 0,             // F6: zoom del contenido (en V1, cada recuadro aparece con este zoom)
  iman: 0,             // F7: imán con la voz (siempre activo: el fader en 0 lo apaga)
  feedback: 0,         // F8: feedback sobre el collage (V1 túnel · V2 giro · V3 sandin)

  // toggles
  usaBarrido: false,   // N11: el recuadro entra barriendo
  siguenRitmo: false,  // N13: jitter y mala señal laten con los recuadros
  apagaFondo: 0,       // N18 (4 estados): el collage se apaga hacia negro — 0 nada · 1 suave · 2 normal · 3 extremo
                       //   (en silencio, también el último recuadro). Tiempos de cada nivel: fondoNiveles en el motor
  negros: 0,           // N28 (4 estados): recuadros negros — 0 ninguno · 1 15 % · 2 30 % · 3 50 % (negrosNiveles)

  colorBase: 0,        // color de la rueda (0 a 1); cada recuadro toma uno de su tríada

  rafagaCantidad: 3,   // recuadros seguidos al cambiar de estado (nunca negros)
  tiron: 0.02,         // fuerza del tirón de glitch del canal 2 / la fila 6 (anda aunque F5 esté en 0)
  tironCaida: 0.3,     // segundos que tarda en apagarse después de cada nota

  // duración por nota (idea de Fluorescente)
  aparicionLarga: 0.4, // s que tarda en abrirse del todo un recuadro mientras la nota se sostiene
  aparicionQueda: true, // al soltar la nota el recuadro se queda del tamaño al que llegó (false = termina de abrirse)
  aparicionPiso: 0.1,  // lo mínimo que se abre (notas muy cortas)
  aparicionRitmo: 0.25, // al soltar, la aparición termina en esta fracción del tiempo entre disparos
  barridoRitmo: 0.8,   // el barrido dura esta fracción del tiempo entre disparos (como mucho barridoDur)
  silencio: 0.6,       // s sin notas = silencio: el feedback (F8) frena…
  caidaSilencio: 1.5,  // …en este tiempo, y vuelve con la próxima nota
  color9: 0.6,         // cuánto gira el color con el canal 9 / la fila 5
  micPiso: 0.5,        // el mic no hace nada por debajo de esto
  mostrarMic: true,
})


// ============================================================
// CONTROLES — qué hay en la consola en esta canción.
// Mismo nombre que en V.init: los estados usan estos nombres.
// ============================================================
const CONTROLES = {
  jitter:      'F1',
  pixelado:    'F2',
  marco:       'F3',
  tinte:       'F4',
  malaSenal:   'F5',   // antes F7
  zoom:        'F6',
  iman:        'F7',   // antes F5
  feedback:    'F8',
  // versiones: el botón redondo arriba de cada fader pasa a la siguiente (V1 → V2 → V3)
  verJitter:    'V1',  // F1: temblor · rasgado · franjas
  verPixelado:  'V2',  // F2: pixelado · bloques · poster
  verMarco:     'V3',  // F3: marco · marco + mosaico
  verTinte:     'V4',  // F4: tríada · tono · canales
  verMalaSenal: 'V5',  // F5: banda · vhs (colores corridos, ondas, tracking) · rueda (rueda + interferencia)
  verFeedback:  'V8',  // F8: túnel · giro · sandin
  verAparicion: 'V6',  // F6: cómo aparece cada recuadro — zoom del contenido · el marco se abre · desde una línea (tele)
  usaBarrido:  'N11',
  siguenRitmo: 'N13',
  apagaFondo:  'N18',  // 4 estados
  negros:      'N28',  // 4 estados
  // mutes por fila (true = muteado): un canal muteado no hace nada (los pads a mano siguen andando)
  muteCanal1:  'M8',
  muteCanal10: 'M7',
  muteCanal2:  'M6',
  muteCanal9:  'M5',
}

// base de los mutes: los recuadros los dispara sólo el canal 1 (bajo); el bombo queda muteado.
// El canal 2 (tirón de glitch) y el 9 (color) quedan muteados de base: cada estado los abre donde entran
// ({ ..., muteCanal2: false } = en ese estado el teclado da el tirón).
// En vivo: 83 / 84 / 85 los prenden o apagan hasta el próximo cambio de estado.
const BASE_CANALES = { muteCanal1: false, muteCanal10: true, muteCanal2: true, muteCanal9: true }


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Cada estado anota sólo lo que cambia respecto de la BASE.
//   como: N   → arranca del estado N y le cambia lo que anota
//   fundido   → segundos que tarda en llegar (si no se anota: 0.3)
// Valores de la v03 (curados 30/9 – 1/10). GP.estados.tabla() los muestra todos.
// Reglas: pixelado alto sólo en 1-2 momentos · zoom alto sólo en acentos ·
//         mala señal se toca a mano · un estado que repite a otro copia su color.
// ============================================================
const ESTADOS_CANCION = [
  /*  1 */ { nombre: 'arranque simple',               pixelado: 0, malaSenal: 0.10, siguenRitmo: true },
  /*  2 */ { nombre: 'sigue simple, crece un poco',   marco: 0.28, zoom: 0.90, colorBase: 0.08, siguenRitmo: true },
  /*  3 */ { nombre: 'simple, crece más',             marco: 0.36, zoom: 0.08, colorBase: 0.15 },
  /*  4 */ { nombre: 'repite el 3',                   como: 3 },
  /*  5 */ { nombre: 'cambio fuerte',                 jitter: 0.60, pixelado: 0.10, marco: 0.55, tinte: 0.40, iman: 0.30, zoom: 0.65, usaBarrido: true, colorBase: 0.40 },
  /*  6 */ { nombre: 'se calma',                      jitter: 0.10, marco: 0.45, tinte: 0.15, iman: 0.10, zoom: 0.10, colorBase: 0.45 },
  /*  7 */ { nombre: 'sube la intensidad',            jitter: 0.35, pixelado: 0.10, marco: 0.60, tinte: 0.35, iman: 0.35, zoom: 0.15, usaBarrido: true, colorBase: 0.52 },
  /*  8 */ { nombre: 'momento mágico',                jitter: 0.75, pixelado: 0.75, marco: 0.65, tinte: 0.45, iman: 0.45, zoom: 0.70, usaBarrido: true, colorBase: 0.60 },
  /*  9 */ { nombre: 'bajada fuerte',                 jitter: 0.10, marco: 0.35, tinte: 0.15, iman: 0.10, zoom: 0.10, colorBase: 0.68 },
  /* 10 */ { nombre: 'mínimo, casi apagado',          marco: 0.20, tinte: 0.05, zoom: 0.05, colorBase: 0.75 },
  /* 11 */ { nombre: 'se siente que viene el pico',   jitter: 0.45, pixelado: 0.10, marco: 0.55, tinte: 0.35, iman: 0.40, zoom: 0.15, usaBarrido: true, colorBase: 0.83 },
  /* 12 */ { nombre: 'explota al máximo',             jitter: 1.00, pixelado: 0.75, marco: 1.00, tinte: 0.85, iman: 1.00, zoom: 0.80, usaBarrido: true, colorBase: 0.90 },
  /* 13 */ { nombre: 'cierre',                        jitter: 0.20, marco: 0.50, tinte: 0.30, iman: 0.20, zoom: 0.10, colorBase: 0.97 },
]

// ============================================================
// ESTADOS DE PRUEBA — las 7 partes del ensayo de 3:48 (ensayo/ensayo 3/…_toma3m47).
// Cada parte prueba algunas versiones nuevas. Antes de dar ▶ al reproductor: GP.estados.reiniciar()
//   parte 1  0:01  bombo solo, el bajo casi no toca
//   parte 2  0:18  entra el bajo (poco)
//   parte 3  0:53  bajo completo + teclado (canal 2)
//   parte 4  1:29  bajo con notas largas + canal 9
//   parte 5  2:04  bajo completo + canal 9 + teclado (desde 2:20)
//   parte 6  2:39  bajo completo, el canal 9 se apaga
//   parte 7  3:14  bajo completo, cierre
// Versiones: 0 = V1 · 1 = V2 · 2 = V3
// ============================================================
const ESTADOS_PRUEBA = [
  /* 1 */ { nombre: '1 · intro: ventanas que se abren', jitter: 0.31, pixelado: 0, marco: 0.29, verJitter: 1, verMalaSenal: 1, 
            verAparicion: 2, siguenRitmo: true },
  /* 2 */ { nombre: '2 · entra el bajo: vhs (F5 V2) + el marco se abre (F6 V2) + apagado + negros',
            marco: 0.3, jitter: 0.15, malaSenal: 0.25, verMalaSenal: 1, verAparicion: 1, colorBase: 0.08,
            apagaFondo: 2, negros: 1 },
  /* 3 */ { nombre: '3 · teclado: tirón de glitch + bloques (F2 V2) + canales (F4 V3) + saltos (F5 V1) + negros', muteCanal2: false,
            marco: 0.45, jitter: 0.2, pixelado: 0.35, verPixelado: 1, tinte: 0.4, verTinte: 2, colorBase: 0.20,
            malaSenal: 0.2, verMalaSenal: 0, negros: 2 },
  /* 4 */ { nombre: '4 · notas largas: color + mosaico (F3 V2) + sandin (F8 V3) + aparición tele (F6 V3)', muteCanal9: false,
            marco: 0.5, verMarco: 1, zoom: 0.2, verAparicion: 2, feedback: 0.4, verFeedback: 2, colorBase: 0.40, fundido: 1,
            negros: 1 },
  /* 5 */ { nombre: '5 · todo: tirón + color + rasgado (F1 V2) + rueda (F5 V3)', muteCanal2: false, muteCanal9: false,
            marco: 0.6, jitter: 0.6, verJitter: 1, malaSenal: 0.4, verMalaSenal: 2, tinte: 0.3, iman: 0.5, usaBarrido: true, colorBase: 0.55,
            negros: 1 },
  /* 6 */ { nombre: '6 · baja: tono (F4 V2) + poster (F2 V3) + el marco se abre (F6 V2) + apagado + negros',
            marco: 0.4, jitter: 0.1, tinte: 0.5, verTinte: 1, pixelado: 0.4, verPixelado: 2, verAparicion: 1, colorBase: 0.70,
            apagaFondo: 2, negros: 3 },
  /* 7 */ { nombre: '7 · cierre: giro (F8 V2) + pixelado fuerte + saltos (F5 V1) + apagado + negros',
            marco: 0.5, tinte: 0.2, malaSenal: 0.15, pixelado: 0.75, feedback: 0.35, verFeedback: 1, colorBase: 0.85,
            apagaFondo: 2, negros: 3 },
]

const ESTADOS = ESTADOS_PRUEBA   // ← poné ESTADOS_CANCION para volver a los 13 de la canción


// ============================================================
// AKAI — mapa LIVE (mismo orden de canales que las otras canciones)
//   fila 8 → canal 1 (bajo). Es el que dispara los recuadros. Mute: botón 82
//   fila 7 → canal 10 (bombo, una nota por negra). De base muteado. Mute: botón 83
//   fila 6 → canal 2 (teclado distorsionado): cada nota da un TIRÓN DE GLITCH en toda la pantalla. Mute: botón 84
//            pads de la fila 6 a mano: tirón mientras los apretás
//   fila 5 → canal 9 (notas largas): cada nota gira el color de toda la imagen. Mute: botón 85
//            pads de la fila 5 a mano: cada pad es un color
//   fila 4 → libre
//   Filas 8 y 7: cada nota de un canal activo = un recuadro nuevo. Cualquier pad a mano = un recuadro.
//   Mientras la nota (o el pad) se sostiene, el recuadro se sigue abriendo; al soltar termina según el ritmo
//   (y si estaba barriendo, cae en su lugar).
//   N11 / N13 = barrido / jitter y mala señal laten con los recuadros (N12 libre: el imán es sólo F7)
//   N18 (4 estados) = el collage se apaga hacia negro: 0 nada · 1 suave · 2 normal · 3 extremo
//   N28 (4 estados) = recuadros negros: 0 ninguno · 1 15 % · 2 30 % · 3 50 %
//   pads de estados: cada toque pasa al siguiente · Shift + pad = anterior
//   (LED: verde = 0 · verde parpadeo = 1 · amarillo parpadeo = 2 · rojo parpadeo = 3)
//   F1 jitter · F2 pixelado · F3 marco · F4 tinte · F5 mala señal · F6 zoom · F7 imán · F8 feedback
//   Botones redondos 64-71 (arriba de cada fader) = versión del efecto (F1, F2, F3, F4, F5, F6 aparición, F8)
//   87 / 88 = estado anterior / siguiente (ensayo o emergencia)
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons({ N11: 'toggle', N13: 'toggle', N18: 4, N28: 4 })
GP.midi.versiones({ F1: 3, F2: 3, F3: 2, F4: 3, F5: 3, F6: 3, F8: 3 })   // igual que V.CUANTAS del motor
GP.midi.filas({
  8: { canal: 1, rango: [26, 61] },
  7: { canal: 10, pulso: 'vuelta' },
  6: { canal: 2, rango: [60, 72] },
  5: { canal: 9, notas: [59, 60, 62, 64, 69, 71] },
})

// los estados van después de V.init, de los botones y de las filas
GP.estados.init({
  cancion: '02_Buscando_Placer',
  destino: V.C,
  base: BASE_CANALES,
  controles: CONTROLES,
  estados: ESTADOS,
  alEntrar: () => V.rafaga(),      // cada estado nuevo arranca con una ráfaga de recuadros
})

GP.midi.alDisparo(({ fila, columna, nota, on, origen }) => {
  if (fila === 6) { V.tiron(on, origen === 'akai' ? `pad${columna}` : `n${nota}`); return }   // canal 2 o pads de la fila 6
  if (fila === 5) { if (on) V.color9(columna); return }         // canal 9 o pads de la fila 5
  // filas 8 y 7: recuadros. La clave identifica la nota (o el pad) para saber cuándo se suelta
  const clave = origen === 'akai' ? `pad${fila}.${columna}` : `f${fila}.${nota}`
  if (on) V.disparar(clave)
  else V.soltar(clave)
})


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0, o1)
render(o1)
