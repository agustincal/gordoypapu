// ============================================================
// GP_04_James__visual_v03.js  ·  produccion/04_James/arq/  (DESARROLLO)
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: motor visual v03 — rectángulos de luz, blanco puro, pantalla plana.
//      Referencia: videos de Milian Mori. Arranca con la escena Puertas.
// Lo carga el sketch produccion/04_James/sketches/04_James_v03.js; el sketch llama GP.james.*
// Actualizado: 20/10/2026 (v3.6: versiones de F1, F2 y F3 — ver 'Versiones' abajo.
//              v3.5: faders — F1 franjas (1 a 8, siempre escalonado) · F2 estela ·
//              F3 duración del gesto (de negra a redonda, mantiene la proporción de abre/sostiene/cierra).
//              v3.4: estela — el borde que se mueve deja un degradado adentro de su recuadro.
//              v3.3: pantalla completa; escalonado en franjas horizontales con demoras al azar.
//              v3.2: un panel que se abre desde un borde y se cierra hacia el otro,
//              como si se desplazara; abre y cierra con el mismo ease in-out (curva);
//              la frase se arma a partir de la duración de la animación)
// ============================================================
//
// Pulso: sale del clock MIDI (24 ticks por negra; el Start lo pone en cero),
// así sigue a la canción del ensayo. Si no llega clock, usa un reloj propio a C.bpm.
//
// Todo lo ajustable vive en GP.james.C. Ahí escriben:
//   - el sketch, con V.init({ ... })            (la base de la canción)
//   - GP_estados, al cambiar de estado          (lo que anota cada estado)
//   - vos, en vivo:  V.C.cierra = 1  + Ctrl+Enter
//
// El sketch llama:
//   GP.james.init(config) · .salida(o0) · .update()
//   GP.james.midi(nombre, data)    todo lo que entra (para el clock)
//   GP.james.toggleCodigo()        oculta / muestra el código y los paneles
//   GP.james.negras()              negras desde el Start (con decimales), para probar
// ============================================================

;(function () {
  if (!window.GP) window.GP = {}
  const GP = window.GP
  const VERSION = 'v3.6'

  if (GP.james && GP.james._version === VERSION) return
  GP.james = { _version: VERSION }
  const V = GP.james

  const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2
  // ease in-out con la fuerza que quieras: p = 3 suave · p = 6 muy pronunciada (arranca y termina muy lento)
  const inOut = (x, p) => x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2 * x, p) / 2 : 1 - Math.pow(2 - 2 * x, p) / 2
  const mod = (a, n) => ((a % n) + n) % n
  const frac = x => x - Math.floor(x)
  const azar = (a, b = 0) => frac(Math.sin(a * 127.1 + b * 311.7) * 43758.5453)

  // ---- valores por defecto ----
  const DEFAULTS = {
    bpm: 136,                    // reloj propio, sólo si no llega clock MIDI

    // ---- puertas ----
    alto: [0, 1],                // franja de la pantalla donde viven los paneles (0 = arriba · 1 = abajo)
    // ---- duración (F3) ----
    // abre, sostiene, cierra, silencio y demora son PROPORCIONES: la duración real
    // la da 'duracion'. Así el gesto mantiene su forma y sólo cambia la velocidad.
    duracion: 1,                 // F3 · 0 = el gesto (abre + sostiene + cierra) dura durMin · 1 = durMax
    durMin: 1,                   // negras con F3 abajo (1 = una negra)
    durMax: 4,                   // negras con F3 arriba (4 = una redonda)
    abre: 4,                     // proporción que tarda en abrir
    sostiene: 1,                 // proporción que queda abierto
    cierra: 4,                   // proporción que tarda en plegarse hasta desaparecer
    curva: 6,                    // fuerza del ease in-out del pliegue (3 = suave · 6 = muy pronunciado · 10 = extremo)
                                 // con la curva fuerte, al final se mueve tan despacio que la línea
                                 // parece quedarse un ratito antes de irse (no es un sostenido)
    linea: 0.004,                // ancho de la línea final antes de desaparecer
    prob: 0.6,                   // chance de que cada panel se prenda en cada ciclo
    // escalonado: el panel se parte en franjas horizontales y cada una arranca un poco tarde
    franjas: 3 / 7,              // F1 · 0 = 1 franja · 1 = 8 franjas (3/7 = 4 franjas)
    demora: 0.5,                 // proporción de demora máxima de una franja; cada una toma una
                                 // demora al azar entre 0 y esto, distinta en cada ciclo
    // estela: el borde que se mueve deja un degradado (como un blur de movimiento) que
    // queda adentro de su recuadro. Cuanto más rápido va el borde, más largo el degradado;
    // quieto, el borde es duro.
    estela: 0.3,                 // F2 · largo del degradado (0 = borde duro · 1 = muy largo); acompaña a la duración

    // ---- versiones (botón redondo arriba de cada fader: v1 → v2 → v3) ----
    verFranjas: 0,               // V1 · 0 parejas · 1 desparejas (alto al azar en cada ciclo) · 2 persiana (con hueco)
    verEstela: 0,                // V2 · 0 degradado · 1 eco (degradado en escalones) · 2 agujas (líneas finas)
    verGesto: 0,                 // V3 · 0 desplazamiento · 1 ida y vuelta · 2 cruzado (dos que se cruzan con diff)
    hueco: 0.35,                 // persiana: parte negra de cada franja
    escalones: 4,                // eco: cuántos escalones tiene el degradado
    agujas: 7,                   // agujas: cuántas líneas deja el borde en su recorrido
    // la frase se arma sola a partir de la animación (nunca se corta):
    silencio: 0.5,               // proporción de negro al final de cada ciclo, antes del siguiente
    ciclos: 3,                   // ciclos de puertas por frase
    negro: 3,                    // negras de negro después de los ciclos
    golpe: 3,                    // negras que la sala entera queda prendida
    barrido: 1.5,                // negras que tarda el barrido final en cerrar la sala
    // paneles: [x0, x1, dirección]
    //   dirección 1  = se abre desde el borde izquierdo hacia la derecha y se cierra
    //                  también de izquierda a derecha: parece que se desplazó
    //   dirección -1 = lo mismo, de derecha a izquierda
    // El primero siempre se prende; los demás según 'prob'.
    paneles: [
      [0, 1, 1],                 // pantalla completa
    ],
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS
  const MAX_PANELES = 2

  // ============================================================
  // Pulso: clock MIDI (o reloj propio)
  // ============================================================
  const R = window._jamesReloj || (window._jamesReloj = { ticks: 0, tUltimo: -1e9, periodo: 1000 / (136 / 60 * 24) })
  V.midi = (nombre, data) => {
    const st = data[0]
    if (st === 0xfa) { R.ticks = 0; R.tUltimo = performance.now(); return }        // Start
    if (st !== 0xf8) return                                                          // sólo clock
    const ahora = performance.now()
    const d = ahora - R.tUltimo
    if (d > 5 && d < 200) R.periodo += (d - R.periodo) * 0.1                         // tempo suavizado
    R.tUltimo = ahora
    R.ticks++
  }
  const hayClock = () => performance.now() - R.tUltimo < 1000
  // negras desde el Start (con decimales entre ticks)
  const nb = () => {
    if (hayClock()) {
      const entre = Math.min(1, (performance.now() - R.tUltimo) / R.periodo)
      return (R.ticks + entre) / 24
    }
    return time * C.bpm / 60
  }
  V.negras = nb

  // ============================================================
  // Puertas
  // ============================================================
  // La frase se arma a partir de la animación, así nada se corta:
  //   ciclo  = abre + sostiene + cierra + silencio, redondeado a negras enteras
  //   frase  = ciclos × ciclo  →  negro  →  golpe (la sala entera)  →  barrido
  // Ejemplo con la base (abre 0.12 · sostiene 1 · cierra 1.5 · silencio 0.5):
  //   ciclo de 4 negras · 3 ciclos = 12 · negro 3 · golpe 3 · barrido 1.5 → frase de 20 negras (redondeada)
  // cuántas negras vale una unidad de proporción (F3 → duración del gesto)
  const clamp01 = v => Math.max(0, Math.min(1, v))
  const escala = () => {
    const dur = C.durMin * Math.pow(C.durMax / C.durMin, clamp01(C.duracion))   // de negra a redonda, parejo al oído
    return dur / Math.max(0.001, C.abre + C.sostiene + C.cierra)
  }
  const T = k => C[k] * escala()                                // abre, sostiene, cierra, silencio, demora en negras
  // el ciclo se redondea a medias negras para seguir a tempo
  const largoCiclo = () => Math.max(0.5, Math.ceil((T('abre') + T('sostiene') + T('cierra') + T('silencio')) * 2) / 2)
  const largoFrase = () => Math.ceil(C.ciclos * largoCiclo() + C.negro + C.golpe + C.barrido)
  const frase = () => mod(nb(), largoFrase())
  const nFrase = () => Math.floor(nb() / largoFrase())
  const inicioGolpe = () => C.ciclos * largoCiclo() + C.negro
  const inicioBarrido = () => inicioGolpe() + C.golpe

  // en qué momento está un panel:
  //   { desde, hasta } = qué parte del panel está prendida (0 = su borde de entrada · 1 = el otro borde)
  //   null = apagado
  // Abre:   el frente avanza desde el borde de entrada hasta el otro (desde 0, hasta 0 → 1)
  // Cierra: la cola avanza en la misma dirección (desde 0 → 1, hasta 1): parece que se desplazó
  // n = en qué negra (ya con el atraso de la franja descontado)
  const momento = (i, n) => {
    const f = mod(n, largoFrase()), nF = Math.floor(n / largoFrase())
    if (f >= inicioGolpe()) return { desde: 0, hasta: 1 }   // golpe: todo prendido (el barrido lo recorta)
    if (f >= C.ciclos * largoCiclo()) return null           // negro
    const L = largoCiclo()
    const ciclo = Math.floor(f / L), k = f - ciclo * L
    if (i > 0 && azar(i + 1, nF * 3 + ciclo) > C.prob) return null
    const ab = T('abre'), so = T('sostiene'), ci = T('cierra')
    if (k < ab) return { desde: 0, hasta: inOut(k / ab, C.curva) }
    if (k < ab + so) return { desde: 0, hasta: 1 }
    const c = (k - ab - so) / ci
    if (c >= 1) return null
    // ida y vuelta: se cierra volviendo hacia el borde de entrada (como una tecla que sube)
    if ((C.verGesto | 0) === 1) return { desde: 0, hasta: 1 - inOut(c, C.curva) }
    // desplazamiento (y cruzado): la cola sigue en la misma dirección, parece que se desplazó
    return { desde: inOut(c, C.curva), hasta: 1 }
  }
  // franjas activas y la demora de cada una (cambia en cada ciclo, sin orden: más natural)
  const MAX_FRANJAS = 8
  const nFranjas = () => 1 + Math.round(clamp01(C.franjas) * (MAX_FRANJAS - 1))     // F1: de 1 a 8
  // capa: 0 = la de siempre · 1 = la que cruza en sentido contrario (sólo en el gesto cruzado)
  const atrasoDe = (i, j, capa = 0) => {
    if (nFranjas() === 1 && capa === 0) return 0
    const ciclo = Math.floor(nb() / largoCiclo())
    return T('demora') * azar(j * 7.31 + i * 13.7 + 1.7 + capa * 5.3, ciclo * 3.1 + 0.5 + capa)
  }
  // dónde está la franja j del panel i en la negra n: [x0, x1] o null (apagada)
  const posicion = (i, j, n, capa = 0) => {
    const p = C.paneles[i]
    if (!p || j >= nFranjas()) return null
    if (capa === 1 && (C.verGesto | 0) !== 2) return null
    const m = momento(i, n - atrasoDe(i, j, capa))
    if (!m) return null
    const [a, b, d0] = p
    const dir = capa === 1 ? -d0 : d0
    let d = m.desde, h = m.hasta
    const minimo = C.linea / Math.max(0.001, b - a)          // nunca más fino que una línea
    if (h - d < minimo) { if (d === 0) h = minimo; else d = h - minimo }
    // dirección 1: de a hacia b · dirección -1: de b hacia a
    return dir >= 0
      ? [a + (b - a) * d, a + (b - a) * h]
      : [b - (b - a) * h, b - (b - a) * d]
  }
  // valores para la caja: k = 0 borde izquierdo · 1 borde derecho ·
  //                       2 estela del borde izquierdo · 3 estela del borde derecho
  // se calcula una sola vez por cuadro para cada franja (los 4 valores juntos)
  const cache = { t: null, v: {} }
  const calcular = (i, j, capa) => {
    const n = nb(), pos = posicion(i, j, n, capa)
    if (!pos) return [2, 2, 0, 0]                           // apagada: fuera de pantalla
    const paso = 0.04, antes = posicion(i, j, n - paso, capa)
    const estela = lado => {
      if (!antes || C.estela <= 0) return 0
      const vel = Math.abs(pos[lado] - antes[lado]) / paso  // pantallas por negra
      return Math.min(pos[1] - pos[0], vel * C.estela * escala())   // nunca más que el recuadro
    }
    return [pos[0], pos[1], estela(0), estela(1)]
  }
  const valor = (i, j, k, capa = 0) => () => {
    if (cache.t !== time) { cache.t = time; cache.v = {} }
    const clave = i * 100 + j * 2 + capa
    if (!cache.v[clave]) cache.v[clave] = calcular(i, j, capa)
    return cache.v[clave][k]
  }
  const barrido = () => {
    const f = frase() - inicioBarrido()
    return f < 0 ? 1 : 1 - inOut(f / Math.max(0.01, C.barrido), C.curva)
  }

  // alto de la franja j de nFranjas (de arriba a abajo), según la versión de F1
  const cortes = () => {                                    // dónde empieza cada franja (0 a 1) + el final
    const n = nFranjas(), v = C.verFranjas | 0
    if (v !== 1) return Array.from({ length: n + 1 }, (_, j) => j / n)
    // desparejas: cada franja con su alto al azar, distinto en cada ciclo
    const ciclo = Math.floor(nb() / largoCiclo())
    const pesos = Array.from({ length: n }, (_, j) => 0.25 + azar(j * 3.7 + 0.9, ciclo * 1.3 + 7))
    const total = pesos.reduce((x, y) => x + y, 0)
    const c = [0]; pesos.forEach(w => c.push(c[c.length - 1] + w / total))
    return c
  }
  let cacheCortes = { t: null, c: null }
  const altoFranja = (j, lado) => () => {
    if (cacheCortes.t !== time) cacheCortes = { t: time, c: cortes() }
    const a = C.alto[0], b = C.alto[1], c = cacheCortes.c
    if (j >= c.length - 1) return 2
    let y0 = c[j], y1 = c[j + 1]
    if ((C.verFranjas | 0) === 2) {                         // persiana: un hueco negro en cada franja
      const m = (y1 - y0) * clamp01(C.hueco) / 2
      y0 += m; y1 -= m
    }
    return a + (b - a) * (lado === 0 ? y0 : y1)
  }
  // cómo deja rastro el borde, según la versión de F2: 0 degradado · 1 eco · 2 agujas
  const modoEstela = () => C.verEstela | 0
  const pasosEstela = () => (C.verEstela | 0) === 1 ? Math.max(2, C.escalones) : C.agujas
  const capaDe = capa => {
    let luz = solid(0, 0, 0)
    for (let i = 0; i < MAX_PANELES; i++) {
      for (let j = 0; j < MAX_FRANJAS; j++) {
        luz = luz.add(caja(valor(i, j, 0, capa), valor(i, j, 1, capa), altoFranja(j, 0), altoFranja(j, 1),
          valor(i, j, 2, capa), valor(i, j, 3, capa), modoEstela, pasosEstela))
      }
    }
    return luz
  }
  // cruzado: la segunda capa va en sentido contrario y se cruza con diff (donde se pisan se invierte)
  const puertas = () => capaDe(0).diff(capaDe(1)).mult(caja(0, barrido, 0, 1, 0, 0, 0, 1))

  // ============================================================
  // Salida
  // ============================================================
  const definirCaja = () => setFunction({
    name: 'caja', type: 'src',
    inputs: [
      { type: 'float', name: 'x0', default: 0.25 }, { type: 'float', name: 'x1', default: 0.75 },
      { type: 'float', name: 'y0', default: 0.25 }, { type: 'float', name: 'y1', default: 0.75 },
      { type: 'float', name: 'ei', default: 0.0 }, { type: 'float', name: 'ed', default: 0.0 },
      { type: 'float', name: 'modo', default: 0.0 }, { type: 'float', name: 'pasos', default: 4.0 },
    ],
    // un rectángulo blanco; y de ARRIBA hacia abajo (0 = arriba).
    // ei / ed = estela hacia adentro desde el borde izquierdo / derecho (0 = borde duro)
    // modo: 0 degradado · 1 eco (degradado en 'pasos' escalones) · 2 agujas ('pasos' líneas finas)
    glsl: `
      float y = 1.0 - _st.y;
      float ax = 0.7 / resolution.x, ay = 0.7 / resolution.y;
      // dentro del recuadro, con borde duro
      float dentro = smoothstep(x0 - ax, x0 + ax, _st.x) * (1.0 - smoothstep(x1 - ax, x1 + ax, _st.x));
      // r = 0 en el borde que se mueve → 1 donde termina la estela
      float ri = clamp((_st.x - x0) / max(ei, ax), 0.0, 1.0);
      float rd = clamp((x1 - _st.x) / max(ed, ax), 0.0, 1.0);
      float r = min(ri, rd);
      float e = r;
      if (modo > 0.5 && modo < 1.5) e = r >= 1.0 ? 1.0 : floor(r * pasos) / pasos;
      if (modo > 1.5) {
        float rl = r >= 1.0 ? 0.0 : fract(r * pasos);
        float px = ax * 2.0 / max(max(ei, ed), ax) * pasos;
        e = r >= 1.0 ? 1.0 : (1.0 - smoothstep(0.0, max(px, 0.08), rl));
      }
      float h = dentro * e;
      float v = smoothstep(y0 - ay, y0 + ay, y) * (1.0 - smoothstep(y1 - ay, y1 + ay, y));
      return vec4(vec3(h * v), 1.0);`
  })

  V.salida = (out) => { puertas().out(out) }
  V.update = () => {}

  // ---- ocultar código y paneles para el show ----
  let codigoVisible = true
  V.toggleCodigo = () => {
    codigoVisible = !codigoVisible
    const partes = ['.CodeMirror', '#editor-container', '#toolbar', '#menu', '#info-container', '#modal']
    document.querySelectorAll(partes.join(',')).forEach(el => { el.style.visibility = codigoVisible ? '' : 'hidden' })
    if (GP.tools && GP.tools.paneles) GP.tools.paneles(codigoVisible)
  }

  V.init = (config = {}) => {
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)
    definirCaja()
    return V
  }

  console.log('[GP] visual James ' + VERSION + ' (DESARROLLO, produccion/04_James/arq) cargado')
})()
