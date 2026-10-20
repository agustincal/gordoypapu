// ============================================================
// GP_04_James__visual_v03.js  ·  produccion/04_James/arq/  (DESARROLLO)
// Canción: 04_James (Gordo y Papu) · Fase 3
// Rol: motor visual v03 — rectángulos de luz, blanco puro, pantalla plana.
//      Referencia: videos de Milian Mori. Arranca con la escena Puertas.
// Lo carga el sketch produccion/04_James/sketches/04_James_v03.js; el sketch llama GP.james.*
// Actualizado: 20/10/2026 (v3.0: Puertas del ejemplo D; pliegue con ease in-out pronunciado;
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
  const VERSION = 'v3.0'

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
    alto: [0.22, 0.78],          // franja de la pantalla donde viven los paneles (de arriba a abajo)
    abre: 0.12,                  // negras que tarda en abrir (casi seco)
    sostiene: 1,                 // negras que queda abierto
    cierra: 1.5,                 // negras que tarda en plegarse hasta desaparecer
    curva: 6,                    // fuerza del ease in-out del pliegue (3 = suave · 6 = muy pronunciado · 10 = extremo)
                                 // con la curva fuerte, al final se mueve tan despacio que la línea
                                 // parece quedarse un ratito antes de irse (no es un sostenido)
    linea: 0.004,                // ancho de la línea final antes de desaparecer
    prob: 0.6,                   // chance de que cada panel se prenda en cada ciclo
    // la frase se arma sola a partir de la animación (nunca se corta):
    silencio: 0.5,               // negras de negro al final de cada ciclo, antes del siguiente
    ciclos: 3,                   // ciclos de puertas por frase
    negro: 3,                    // negras de negro después de los ciclos
    golpe: 3,                    // negras que la sala entera queda prendida
    barrido: 1.5,                // negras que tarda el barrido final en cerrar la sala
    // paneles: [x0, x1, hacia dónde se pliega (0 = izquierda · 0.5 = centro · 1 = derecha)]
    paneles: [
      [0.03, 0.10, 1],
      [0.12, 0.33, 0],
      [0.42, 0.58, 0.5],         // la puerta del centro (siempre se prende)
      [0.64, 0.67, 1],
      [0.67, 0.86, 0],
      [0.89, 0.98, 0],
    ],
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS
  const MAX_PANELES = 12

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
  const largoCiclo = () => Math.max(1, Math.ceil(C.abre + C.sostiene + C.cierra + C.silencio))
  const largoFrase = () => Math.ceil(C.ciclos * largoCiclo() + C.negro + C.golpe + C.barrido)
  const frase = () => mod(nb(), largoFrase())
  const nFrase = () => Math.floor(nb() / largoFrase())
  const inicioGolpe = () => C.ciclos * largoCiclo() + C.negro
  const inicioBarrido = () => inicioGolpe() + C.golpe

  // cuánto está abierto un panel (1 = entero · 0 = línea · -1 = apagado)
  const estado = i => {
    const f = frase()
    if (f >= inicioGolpe()) return 1                        // golpe: todo prendido (el barrido lo recorta)
    if (f >= C.ciclos * largoCiclo()) return -1             // negro
    const L = largoCiclo()
    const ciclo = Math.floor(f / L), k = f - ciclo * L
    if (azar(i + 1, nFrase() * 3 + ciclo) > C.prob && i !== 2) return -1
    if (k < C.abre) return suave(k / C.abre)
    if (k < C.abre + C.sostiene) return 1
    const c = (k - C.abre - C.sostiene) / C.cierra
    return c < 1 ? 1 - inOut(c, C.curva) : -1               // se pliega con ease in-out y se apaga
  }
  const borde = (i, lado) => () => {
    const p = C.paneles[i]
    if (!p) return 2
    const [a, b, ancla] = p
    const e = estado(i)
    if (e < 0) return 2                                     // fuera de pantalla = apagado
    const w = Math.max(C.linea, (b - a) * e)
    const centro = a + (b - a) * ancla + (ancla === 0 ? w / 2 : ancla === 1 ? -w / 2 : 0)
    return lado === 0 ? centro - w / 2 : centro + w / 2
  }
  const barrido = () => {
    const f = frase() - inicioBarrido()
    return f < 0 ? 1 : 1 - inOut(f / Math.max(0.01, C.barrido), C.curva)
  }

  const puertas = () => {
    let luz = solid(0, 0, 0)
    for (let i = 0; i < MAX_PANELES; i++) {
      luz = luz.add(caja(borde(i, 0), borde(i, 1), () => C.alto[0], () => C.alto[1]))
    }
    return luz.mult(caja(0, barrido, 0, 1))
  }

  // ============================================================
  // Salida
  // ============================================================
  const definirCaja = () => setFunction({
    name: 'caja', type: 'src',
    inputs: [
      { type: 'float', name: 'x0', default: 0.25 }, { type: 'float', name: 'x1', default: 0.75 },
      { type: 'float', name: 'y0', default: 0.25 }, { type: 'float', name: 'y1', default: 0.75 },
    ],
    // un rectángulo blanco de borde duro; y de ARRIBA hacia abajo (0 = arriba)
    glsl: `
      float y = 1.0 - _st.y;
      float ax = 0.7 / resolution.x, ay = 0.7 / resolution.y;
      float h = smoothstep(x0 - ax, x0 + ax, _st.x) * (1.0 - smoothstep(x1 - ax, x1 + ax, _st.x));
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
