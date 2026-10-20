// ============================================================
// GP_8bits.js  ·  LIVE/arq/
// Efecto de salida para cualquier canción: aspecto 8 bits. No toca el motor de la canción:
// toma lo que el motor dibuja en un buffer (o1) y lo pasa a la salida (o0) en píxeles grandes
// y cuadrados, blanco o negro puro. Con el nivel en 0 la imagen pasa igual (efecto apagado).
// Actualizado: 20/10/2026 (v1: pixelado + tramado Bayer / damero / umbral. Nació en James)
// ============================================================
//
// QUÉ HACE
//   pixeles  (F4) 0 = apagado · apenas arriba de 0 = píxeles chicos (160 a lo ancho)
//                 · 1 = píxeles enormes (24 a lo ancho). Los píxeles son cuadrados.
//   verPixel (V4) cómo se resuelven los grises (la estela):
//                 0 tramado: el degradado se vuelve una trama de puntos (Bayer 4×4)
//                 1 damero:  trama gruesa de cuadros (Bayer 2×2)
//                 2 umbral:  sin trama, todo blanco o negro duro
//
// USO EN EL SKETCH
//   await cargarGP('LIVE/arq/GP_8bits.js')
//   V.salida(o1)                        // el motor dibuja en o1
//   GP.ochoBits.salida(o1, o0, V.C)     // el efecto lee V.C.pixeles y V.C.verPixel y sale por o0
//   y en el sketch: pixeles / verPixel en V.init, en CONTROLES (ej: pixeles: 'F4', verPixel: 'V4')
//   y la versión del fader en GP.midi.versiones({ F4: 3 })
//   (cualquier objeto sirve como C: el de la canción, o uno propio { pixeles, verPixel })
//   render(o0)
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v1'
  if (GP.ochoBits && GP.ochoBits._version === VERSION) return
  const E = GP.ochoBits = { _version: VERSION }

  const clamp01 = v => Math.max(0, Math.min(1, v))
  // F4 → cuántos píxeles a lo ancho (0 = apagado)
  const ANCHO_FINO = 160, ANCHO_GRUESO = 24, ZONA_APAGADO = 0.02
  E.anchoDe = v => {
    v = clamp01(v)
    if (v < ZONA_APAGADO) return 0
    const k = (v - ZONA_APAGADO) / (1 - ZONA_APAGADO)
    return Math.round(ANCHO_FINO * Math.pow(ANCHO_GRUESO / ANCHO_FINO, k))
  }

  setFunction({
    name: 'ochoBits', type: 'src',
    inputs: [
      { type: 'sampler2D', name: 'tex', default: NaN },
      { type: 'float', name: 'nx', default: 0.0 },
      { type: 'float', name: 'modo', default: 0.0 },
    ],
    // nx = píxeles a lo ancho (0 = pasa la imagen tal cual). El alto sale de la forma de la pantalla
    // para que los píxeles sean cuadrados. Bayer 4×4 = 4 · B2(x, y) + B2(x/2, y/2), con
    // B2(x, y) = 2·|x − y| + y  (la matriz 2×2: 0 2 / 3 1)
    glsl: `
      if (nx < 1.0) return texture2D(tex, _st);
      vec2 g = vec2(nx, max(1.0, floor(nx * resolution.y / resolution.x + 0.5)));
      vec2 celda = floor(_st * g);
      float l = texture2D(tex, (celda + 0.5) / g).r;
      float t = 0.5;
      vec2 p = mod(celda, 4.0);
      vec2 a = mod(p, 2.0);
      vec2 b = floor(p / 2.0);
      float b2a = 2.0 * abs(a.x - a.y) + a.y;
      float b2b = 2.0 * abs(b.x - b.y) + b.y;
      if (modo < 0.5) t = (4.0 * b2a + b2b + 0.5) / 16.0;
      else if (modo < 1.5) t = (b2b + 0.5) / 4.0;
      return vec4(vec3(step(t, l)), 1.0);`
  })

  // fuente: el buffer donde dibuja el motor · destino: la salida · C: de dónde leer los valores
  E.salida = (fuente, destino, C) => {
    ochoBits(fuente, () => E.anchoDe(C.pixeles || 0), () => (C.verPixel | 0)).out(destino)
  }

  console.log('[GP] efecto 8 bits ' + VERSION + ' (LIVE/arq) cargado')
})()
