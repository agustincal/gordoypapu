// ============================================================
// 05_Perdido_v01.js  ·  produccion/05_Perdido/sketches/
// Canción: 05_Perdido (Gordo y Papu) · Fase 3 (desarrollo)
// Rol: sketch de la canción — configuración, estados y ruteo.
//      El motor vive en produccion/05_Perdido/arq/GP_05_Perdido__visual.js
// Actualizado: 22/10/2026 (v01: primera versión — procesador de video en cadena,
//              8 etapas × 8 familias en el Akai, 13 estados del análisis del audio)
// ============================================================
//
// Ensayo sin músicos: en el panel de GP_tools cargá
//   midi  → produccion/05_Perdido/ensayo/05_Perdido_ensayo_interpretado_midi.json
//   audio → produccion/05_Perdido/ensayo/Perdido - MST V2.mp3
// y antes de dar ▶: GP.estados.reiniciar() en la consola.
//
// Para diseñar sin el Akai, en la consola:
//   GP.perdido.catalogo()                                  todas las familias y variantes
//   GP.perdido.poner(3, 'color', 'canales', { entrada: 'bajo' })
//   GP.perdido.golpe('bateria')                            simula un golpe de batería
//   GP.perdido.ver()                                       la cadena en una tabla
//   Ctrl+Alt+E suspender estados · Ctrl+Alt+C copiar el estado actual (para pegarlo en ESTADOS)

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
const archivo = ruta => `https://raw.githubusercontent.com/agustincal/gordoypapu/${GP_SHA}/${ruta}`

await cargarGP('LIVE/arq/GP_midi.js')                                   // Akai: faders, LEDs, FMASTER fundido
await cargarGP('LIVE/arq/GP_tools.js')                                  // SÓLO ENSAYO: grabador (89), panel, reproductor → en el show, borrá esta línea
await cargarGP('LIVE/arq/GP_estados.js')                                // estados: cada nota del canal 16 pasa al siguiente
await cargarGP('produccion/05_Perdido/arq/GP_05_Perdido__visual.js')    // el procesador en cadena

if (GP.tools) { GP.tools.init({ cancion: '05_Perdido' }); GP.tools.panel() }
await GP.midi.start()

const V = GP.perdido


// ============================================================
// BASE — cómo se ve la canción cuando ningún estado dice otra cosa.
// Es también el "inicio" (antes de la primera nota del canal 16).
// Se puede cambiar en vivo: V.C.reposo = 0.1 + Ctrl+Enter
// ============================================================
V.init({
  bpm: 70,                      // tempo propio, sólo si no llega clock MIDI (Perdido: 70)

  // ---- videos: hasta 4 (SHIFT + 82..85 los elige; los estados también, con video: 0..3) ----
  videos: [
    archivo('assets/globitos/globitos.mp4'),
  ],
  video: 0,
  encuadre: 'llenar',           // 'llenar' (recorta sin deformar) · 'repetir' (entero, repetido a los costados) · 'estirar'
  velVideo: 1,

  // ---- la cadena: 8 etapas, columna 1 → columna 8 ----
  //   'familia.variante@entrada'  ·  '-' = bypass  ·  @entrada: bajo | bateria | melodia | extra | - (sola, con el tempo)
  //   familias (fila del Akai): desplaza (8) · feedback (7) · color (6) · contorno (5)
  //                             simetria (4) · deforma (3) · glitch (2) · estela (1)
  cadena: ['-', '-', 'color.colorama@-', '-', '-', 'glitch.vhs@-', '-', '-'],
  modo: 'TTTTTTTT',             // T transformación · M mezcla (una letra por columna)
  f1: 0.5, f2: 0.5, f3: 0.25, f4: 0.5, f5: 0.5, f6: 0.35, f7: 0.5, f8: 0.5,

  // ---- cómo responden a la música ----
  reposo: 0.25,                 // con entrada: cuánto queda del efecto cuando no suena
  sostenido: 0.8,               // bajo y melodía: nivel mientras la nota sigue sonando
  pulsoAuto: 1,                 // sin entrada: un golpe propio cada negra
  golpeAlCambiar: true,         // cada cambio de estado sacude todas las etapas

  // ---- entradas MIDI: canal y botón (82-85). Rangos del análisis del audio ----
  entradas: {
    bajo:    { canal: 1,  boton: 82, led: 'verde',         caida: 1,    rango: [25, 49] },
    bateria: { canal: 10, boton: 83, led: 'rojo',          caida: 0.35, acento: [38, 39, 40] },   // 37 bombo · 38 caja (acento)
    melodia: { canal: 2,  boton: 84, led: 'amarillo',      caida: 0.6,  rango: [64, 91] },
    extra:   { canal: 3,  boton: 85, led: 'verdeParpadeo', caida: 0.5,  rango: [36, 96] },        // libre, para el cableado nuevo
  },
})


// ============================================================
// CONTROLES — los faders son la intensidad de cada etapa.
// (los pads, las variantes y los modos los guarda la cadena)
// ============================================================
const CONTROLES = {
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6', f7: 'F7', f8: 'F8',
}


// ============================================================
// ESTADOS — cada nota del canal 16 pasa al siguiente.
// Los 13 cortes del análisis del audio (70 BPM). Cada estado anota sólo lo que cambia
// respecto de la BASE. fundido = segundos que tardan los faders en llegar
// (la cadena cambia al instante, tapada por el golpe de cambio de estado).
// Orden de rack que se repite: 1 desplaza · 2 deforma · 3 color · 4 contorno ·
//                              5 simetría · 6 glitch · 7 feedback · 8 estela
// ============================================================
const ESTADOS = [
  /*  1 · 0:03 */ { nombre: 'intro',
                    cadena: ['-', 'deforma.ondas@bajo', 'color.colorama@-', '-', '-', 'glitch.vhs@-', '-', 'estela.estela@-'],
                    f2: 0.3, f3: 0.35, f6: 0.5, f8: 0.5, fundido: 2 },
                  //   el video casi limpio, cinta vieja: ondula con el bajo y deja estela
  /*  2 · 0:09 */ { nombre: 'entra el bombo',
                    cadena: ['desplaza.franjas@bateria', 'deforma.ondas@bajo', 'color.colorama@bajo', '-', '-', 'glitch.saltos@bateria', '-', 'estela.estela@-'],
                    f1: 0.5, f2: 0.4, f3: 0.5, f6: 0.6, f8: 0.4 },
                  //   el bombo rasga franjas y hace saltar la imagen; el bajo gira el color
  /*  3 · 0:30 */ { nombre: 'corte',
                    cadena: ['-', 'deforma.ruido@-', 'color.tono@melodia', 'contorno.umbral@-', '-', '-', 'feedback.tunel@-', 'estela.estela@-'],
                    modo: 'TTTMTTTT', f2: 0.35, f3: 0.6, f4: 0.45, f7: 0.6, f8: 0.5, fundido: 1.5 },
                  //   sin bombo: túnel de feedback y la imagen a medias en blanco y negro
  /*  4 · 0:44 */ { nombre: 'vuelve',
                    cadena: ['desplaza.repite@bateria', 'deforma.ondas@bajo', 'color.poster@-', '-', 'simetria.espejo@bateria', 'glitch.bloques@bateria', '-', 'estela.estela@-'],
                    modo: 'TTTTMTTT', f1: 0.4, f2: 0.4, f3: 0.5, f5: 0.6, f6: 0.5, f8: 0.35 },
                  //   vuelve el bombo: la imagen se repite, se espeja y se pixela con cada golpe
  /*  5 · 1:11 */ { nombre: 'subida',
                    cadena: ['-', 'deforma.remolino@bajo', 'color.colorama@-', '-', '-', 'glitch.vhs@-', 'feedback.giro@bajo', 'estela.luz@-'],
                    f2: 0.6, f3: 0.5, f6: 0.6, f7: 0.75, f8: 0.4, fundido: 6 },
                  //   crece el sub: el feedback gira cada vez más (se va acercando en 6 s)
  /*  6 · 1:25 */ { nombre: 'sub',
                    cadena: ['desplaza.franjas@bateria', 'deforma.ondas@bajo', 'color.canales@bajo', 'contorno.contraste@-', 'simetria.cuatro@bateria', 'glitch.rasgado@bateria', 'feedback.sandin@-', '-'],
                    modo: 'TTTTMTTT', f1: 0.6, f2: 0.7, f3: 0.6, f4: 0.4, f5: 0.6, f6: 0.7, f7: 0.6 },
                  //   lo más fuerte: todo a la vez, colores corridos y simetría de 4 con el bombo
  /*  7 · 1:39 */ { como: 6, nombre: 'sub + hats',
                    cadena: ['desplaza.franjas@bateria', 'deforma.ondas@bajo', 'color.canales@bajo', 'contorno.contraste@-', 'simetria.tres@bateria', 'glitch.canales@bateria', 'feedback.sandin@-', 'estela.congelar@bateria'],
                    f8: 0.5 },
                  //   + cuadros congelados con cada golpe de batería
  /*  8 · 1:52 */ { nombre: 'sub brillo',
                    cadena: ['desplaza.corre@bajo', 'deforma.lente@bajo', 'color.tono@melodia', 'contorno.bordes@-', '-', 'glitch.canales@bateria', 'feedback.sandin@-', 'estela.estela@-'],
                    modo: 'TTTMTTTT', f1: 0.5, f2: 0.6, f3: 0.6, f4: 0.6, f6: 0.6, f7: 0.5, f8: 0.4 },
                  //   bordes de luz mezclados con la imagen; la melodía cambia el tono
  /*  9 · 2:03 */ { nombre: 'hueco',
                    cadena: ['-', '-', 'color.poster@-', 'contorno.umbral@-', '-', '-', '-', 'estela.congelar@-'],
                    f3: 0.8, f4: 1, f8: 1, fundido: 0 },
                  //   un compás vacío: blanco y negro duro, imagen congelada a tempo
  /* 10 · 2:06 */ { nombre: 'grave F',
                    cadena: ['desplaza.rueda@bajo', 'deforma.remolino@bajo', 'color.invierte@bateria', '-', 'simetria.ocho@bateria', 'glitch.vhs@-', 'feedback.tunel@bajo', '-'],
                    modo: 'TTTTMTTT', f1: 0.4, f2: 0.6, f3: 0.5, f5: 0.6, f6: 0.6, f7: 0.6 },
                  //   otra parte: la imagen rueda como un VHS sin tracking, caleidoscopio de 8 con el bombo
  /* 11 · 2:37 */ { nombre: 'respira',
                    cadena: ['-', 'deforma.ruido@-', 'color.colorama@melodia', '-', '-', '-', 'feedback.deriva@-', 'estela.estela@-'],
                    f2: 0.3, f3: 0.4, f7: 0.5, f8: 0.6, fundido: 3 },
                  //   se van los agudos y el bombo: todo se derrite despacio
  /* 12 · 2:47 */ { nombre: 'final',
                    cadena: ['desplaza.franjas@bateria', 'deforma.ondas@bajo', 'color.canales@bajo', 'contorno.bordes@bateria', 'simetria.cuatro@bateria', 'glitch.saltos@bateria', 'feedback.sandin@bajo', 'estela.congelar@bateria'],
                    modo: 'TTTMMTTT', f1: 0.6, f2: 0.6, f3: 0.6, f4: 0.5, f5: 0.5, f6: 0.7, f7: 0.6, f8: 0.5 },
                  //   vuelve todo, las 8 etapas prendidas
  /* 13 · 3:11 */ { nombre: 'cierre',
                    cadena: ['-', '-', 'color.colorama@-', '-', '-', 'glitch.vhs@-', 'feedback.tunel@-', 'estela.estela@-'],
                    f3: 0.3, f6: 0.5, f7: 0.8, f8: 0.9, fundido: 4 },
                  //   la cola: túnel y estela larga. El negro final con FMASTER
]


// ============================================================
// AKAI — en Perdido la grilla NO es el mapa LIVE de las otras canciones:
// es el procesador.
//   COLUMNA = etapa (1 → 8, en cadena) · FILA = familia (arriba → abajo):
//     8 desplaza · 7 feedback · 6 color · 5 contorno · 4 simetría · 3 deforma · 2 glitch · 1 estela
//   pad = elige el módulo · tocar el pad prendido = bypass de la etapa
//   color del pad = entrada: verde bajo · rojo batería · amarillo melodía · verde parpadeo extra
//                            amarillo parpadeo = sin entrada (con el tempo) · se apaga un instante cuando suena
//   F1..F8 = intensidad de cada etapa · FMASTER = fundido a negro
//   botones de abajo (64-71) = siguiente variante · LED: apagado bypass · prendido transf. · parpadea mezcla
//   SHIFT + botón de abajo = transformación ↔ mezcla
//   82 bajo · 83 batería · 84 melodía · 85 extra = prender / apagar la entrada (parpadea = apagada)
//   86 = asignación: 86 → pad → 82..85 (la misma otra vez la saca) → 86 para salir
//   SHIFT + 82..85 = video 1..4 · SHIFT solo = ocultar código y paneles
//   87 / 88 = estado anterior / siguiente · 89 = grabador (GP_tools)
// ============================================================
GP.midi.filas({})               // sin filas de disparo: la grilla es del procesador
GP.midi.buttons([])
GP.midi.versiones({})           // los botones 64-71 son de las variantes
GP.midi.alDisparo(() => {})

// los estados van después de V.init y de la consola
GP.estados.init({
  cancion: '05_Perdido',
  destino: V.C,
  controles: CONTROLES,
  estados: ESTADOS,
  alEntrar: () => V.alEntrarEstado(),   // cada cambio sacude todas las etapas (tapa el salto)
})

// todo lo que entra: Akai, Korg, clock
GP.midi.alMensaje((nombre, data) => V.midi(nombre, data))


// ============================================================
// RENDER
// ============================================================
update = () => V.update()

V.salida(o0)                    // la cadena termina en o0 (usa o1, o2 de buffers y o3 de memoria)
render(o0)
