// ============================================================
// 02_Buscando_Placer_v01.js  ·  LIVE/sketches/
// Canción: 02_Buscando_Placer (Gordo y Papu) · Fase 3
// Rol: sketch de la canción — sólo configuración, estados y ruteo.
//      El motor vive en LIVE/arq/GP_02_Buscando_Placer__visual.js
// Actualizado: 16/10/2026 (v01: primera versión LIVE. Los 13 estados son los
//              de produccion/02_Buscando_Placer_v03, pasados al formato nuevo)
//              20/10/2026: imágenes de assets/sequence02, 30 JPG numerados (IMAGENES_02); la 01 queda como IMAGENES_01
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
await cargarGP('LIVE/arq/GP_02_Buscando_Placer__visual.js')  // motor de los recuadros

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
  pixelado: 0.05,      // F2: pixelado. Fuerte: alto sólo en 1-2 momentos de la canción
  marco: 0,            // F3: tamaño del marco del recuadro
  tinte: 0,            // F4: cuánto tiñe el color
  iman: 0,             // F5: imán con la voz
  zoom: 0,             // F6: zoom del contenido (además, cada recuadro aparece con zoom)
  malaSenal: 0,        // F7: mala señal de TV (por defecto se toca a mano)

  // toggles
  usaBarrido: false,   // N11: el recuadro entra barriendo
  usaIman: true,       // N12: la voz deforma la imagen
  siguenRitmo: false,  // N13: jitter y mala señal laten con los recuadros

  colorBase: 0,        // color de la rueda (0 a 1); cada recuadro toma uno de su tríada

  rafagaCantidad: 3,   // recuadros seguidos al cambiar de estado
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
  iman:        'F5',
  zoom:        'F6',
  malaSenal:   'F7',
  usaBarrido:  'N11',
  usaIman:     'N12',
  siguenRitmo: 'N13',
  // qué canales disparan recuadros: un canal muteado no dispara (true = muteado)
  muteCanal1:  'M8',
  muteCanal10: 'M7',
  muteCanal2:  'M6',
  muteCanal3:  'M5',
}

// base de los mutes (como en la v03: el canal 1 no dispara, el resto sí)
const BASE_CANALES = { muteCanal1: true, muteCanal10: false, muteCanal2: false, muteCanal3: false }


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Cada estado anota sólo lo que cambia respecto de la BASE.
//   como: N   → arranca del estado N y le cambia lo que anota
//   fundido   → segundos que tarda en llegar (si no se anota: 0.3)
// Valores de la v03 (curados 30/9 – 1/10). GP.estados.tabla() los muestra todos.
// Reglas: pixelado alto sólo en 1-2 momentos · zoom alto sólo en acentos ·
//         mala señal se toca a mano · un estado que repite a otro copia su color.
// ============================================================
const ESTADOS = [
  /*  1 */ { nombre: 'arranque simple',               pixelado: 0, malaSenal: 0.10, siguenRitmo: true },
  /*  2 */ { nombre: 'sigue simple, crece un poco',   marco: 0.28, zoom: 0.90, usaIman: false, colorBase: 0.08, siguenRitmo: true },
  /*  3 */ { nombre: 'simple, crece más',             marco: 0.36, zoom: 0.08, usaIman: false, colorBase: 0.15 },
  /*  4 */ { nombre: 'repite el 3',                   como: 3 },
  /*  5 */ { nombre: 'cambio fuerte',                 jitter: 0.60, pixelado: 0.10, marco: 0.55, tinte: 0.40, iman: 0.30, zoom: 0.65, usaBarrido: true, colorBase: 0.40 },
  /*  6 */ { nombre: 'se calma',                      jitter: 0.10, marco: 0.45, tinte: 0.15, iman: 0.10, zoom: 0.10, colorBase: 0.45 },
  /*  7 */ { nombre: 'sube la intensidad',            jitter: 0.35, pixelado: 0.10, marco: 0.60, tinte: 0.35, iman: 0.35, zoom: 0.15, usaBarrido: true, colorBase: 0.52 },
  /*  8 */ { nombre: 'momento mágico',                jitter: 0.75, pixelado: 0.75, marco: 0.65, tinte: 0.45, iman: 0.45, zoom: 0.70, usaBarrido: true, colorBase: 0.60 },
  /*  9 */ { nombre: 'bajada fuerte',                 jitter: 0.10, marco: 0.35, tinte: 0.15, iman: 0.10, zoom: 0.10, colorBase: 0.68 },
  /* 10 */ { nombre: 'mínimo, casi apagado',          marco: 0.20, tinte: 0.05, zoom: 0.05, usaIman: false, colorBase: 0.75 },
  /* 11 */ { nombre: 'se siente que viene el pico',   jitter: 0.45, pixelado: 0.10, marco: 0.55, tinte: 0.35, iman: 0.40, zoom: 0.15, usaBarrido: true, colorBase: 0.83 },
  /* 12 */ { nombre: 'explota al máximo',             jitter: 1.00, pixelado: 0.75, marco: 1.00, tinte: 0.85, iman: 1.00, zoom: 0.80, usaBarrido: true, colorBase: 0.90 },
  /* 13 */ { nombre: 'cierre',                        jitter: 0.20, marco: 0.50, tinte: 0.30, iman: 0.20, zoom: 0.10, colorBase: 0.97 },
]


// ============================================================
// AKAI — mapa LIVE (mismo orden de canales que las otras canciones)
//   fila 8 → canal 1 (línea principal). De base está muteado: no dispara (botón 82 lo activa)
//   fila 7 → canal 10 (pulso). Mute: botón 83
//   fila 6 → canal 2 (melodía). Mute: botón 84
//   fila 5 → canal 3. Mute: botón 85
//   Cada nota de un canal activo = un recuadro nuevo. Cualquier pad a mano = un recuadro
//   (soltarlo antes de que termine de entrar lo deja caer en su lugar).
//   N11 / N12 / N13 = barrido / imán / jitter y mala señal laten con los recuadros
//   F8 = libre
//   86 / 87 = estado anterior / siguiente (ensayo o emergencia)
//   89 = grabador (GP_tools) · FMASTER = fundido a negro
// ============================================================
GP.midi.buttons(['N11', 'N12', 'N13'])
GP.midi.filas({
  8: { canal: 1, rango: [26, 61] },
  7: { canal: 10, pulso: 'vuelta' },
  6: { canal: 2, rango: [60, 72] },
  5: { canal: 3 },
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

GP.midi.alDisparo(({ on }) => {
  if (on) V.disparar()
  else V.soltar()
})


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0, o1)
render(o1)
