// ============================================================
// GP_05_Perdido__visual.js  ·  produccion/05_Perdido/arq/
// Canción: 05_Perdido (Gordo y Papu) · Fase 3 (desarrollo)
// Rol: procesador de video en cadena, a la manera de un sintetizador de video
//      modular (Sandin Image Processor / LZX): el video entra, pasa por 8 etapas
//      en fila y sale. Cada etapa es una columna del Akai.
// Depende de: GP_midi (LEDs y faders), GP_estados (opcional), GP_tools (opcional, panel)
// Actualizado: 2026-10-22 (v1.0: primera versión)
// ============================================================
//
// La idea en el Akai
// ------------------
//   COLUMNA = etapa de la cadena (1 a la izquierda → 8 a la derecha).
//             Lo que sale de la columna 1 entra en la 2, y así hasta la 8.
//   FILA    = familia de efectos (arriba → abajo):
//             8 desplaza · 7 feedback · 6 color · 5 contorno · 4 simetría · 3 deforma · 2 glitch · 1 estela
//   PAD     = elige el módulo de esa familia para esa etapa. Tocar el pad prendido = bypass.
//   FADER   = intensidad de la etapa (F1 = columna 1 … F8 = columna 8).
//   BOTÓN de abajo de cada columna (64-71) = siguiente variante del módulo.
//   SHIFT + botón de abajo = modo de la etapa: Transformación ↔ Mezcla.
//   82 bajo · 83 batería · 84 melodía · 85 extra = entradas MIDI (prendida / apagada)
//   86 = modo asignación (pad → entrada)
//   SHIFT + 82..85 = video 1..4 · SHIFT solo (tocar y soltar) = ocultar código y paneles
//   87 / 88 estados (GP_estados) · 89 grabador (GP_tools) · FMASTER fundido a negro (GP_midi)
//
// Modos de cada etapa
// -------------------
//   T  Transformación: el efecto reemplaza la imagen. El fader es la fuerza del efecto
//      (con el fader abajo la etapa deja pasar la imagen casi igual).
//   M  Mezcla: el efecto va a fondo y el fader dice cuánto se mezcla con la imagen que entra.
//   -  Bypass: la etapa no hace nada (ningún pad prendido en la columna).
//
// Entradas MIDI
// -------------
//   Cada pad puede tener una entrada asignada (bajo, batería, melodía, extra). Se ve en el color:
//     verde = bajo · rojo = batería · amarillo = melodía · verde parpadeando = extra
//     amarillo parpadeando = sin entrada (se mueve sola, con el tempo)
//   Cuando la entrada suena, el pad se apaga un instante (parpadeo de actividad).
//   Con entrada, el módulo respira con la música: lo que da el fader × (reposo + golpe).
//
// Consola (para probar sin el Akai)
// ---------------------------------
//   GP.perdido.poner(3, 'glitch', 'saltos', { entrada: 'bateria', modo: 'M' })
//   GP.perdido.quitar(3) · .variante(3) · .modo(3, 'M') · .asignar(3, 'bajo')
//   GP.perdido.golpe('bateria') · .video(2) · .ver() · .catalogo()
//   GP.perdido.diagnostico() → muestra en la consola todo lo que manda el Akai
//   GP.perdido.probarColores() → pinta la grilla con los colores del modelo de Akai
// ============================================================

;(function () {
  window.GP = window.GP || {}
  const GP = window.GP
  const VERSION = 'v1.0'

  if (GP.perdido && GP.perdido._version === VERSION) return

  const V = { _version: VERSION }
  const clamp01 = v => Math.max(0, Math.min(1, v))
  const lerp = (a, b, k) => a + (b - a) * k
  const PI = Math.PI

  // ============================================================
  // Configuración (V.init la completa desde el sketch)
  // ============================================================
  const DEFAULTS = {
    bpm: 70,                    // tempo propio si no llega clock MIDI
    videos: [],                 // URLs de los videos (hasta 4: s0..s3)
    video: 0,                   // cuál se ve (0..3) · SHIFT + 82..85
    encuadre: 'llenar',         // 'llenar' (recorta, sin deformar) · 'repetir' (entero, repetido) · 'estirar'
    velVideo: 1,                // velocidad de reproducción del video

    // la cadena: 8 etapas, de izquierda a derecha
    //   'familia.variante@entrada' · '-' = bypass · @entrada es opcional (bajo | bateria | melodia | extra | -)
    cadena: ['-', '-', '-', '-', '-', '-', '-', '-'],
    modo: 'TTTTTTTT',           // T transformación · M mezcla, una letra por etapa
    f1: 0.5, f2: 0.5, f3: 0.5, f4: 0.5, f5: 0.5, f6: 0.5, f7: 0.5, f8: 0.5,   // intensidad de cada etapa (F1..F8)

    // cómo responden los módulos a la música
    reposo: 0.25,               // con entrada asignada: cuánto queda del efecto cuando no suena (0..1)
    sostenido: 0.8,             // bajo y melodía: nivel mientras la nota sigue sonando
    pulsoAuto: 1,               // sin entrada: un golpe propio cada tantas negras (0 = nunca)
    caidaAuto: 0.35,            // sin entrada: lo que tarda en apagarse ese golpe (negras)
    golpeAlCambiar: true,       // cada cambio de estado da un golpe a todas las etapas
    entradas: {
      bajo:    { canal: 1,  boton: 82, led: 'verde',         caida: 1,    rango: [25, 49] },
      bateria: { canal: 10, boton: 83, led: 'rojo',          caida: 0.35, acento: [38, 39, 40], nivelAcento: 0.7 },
      melodia: { canal: 2,  boton: 84, led: 'amarillo',      caida: 0.6,  rango: [64, 91] },
      extra:   { canal: 3,  boton: 85, led: 'verdeParpadeo', caida: 0.5,  rango: [36, 96] },
    },

    // LEDs del Akai (valores de GP.midi.COLOR, APC mini mk1)
    ledSinEntrada: 'amarilloParpadeo',
    ledArmado: 'rojoParpadeo',      // en modo asignación, el pad elegido
    actividadMs: 70,                // lo que se apaga el pad cuando suena su entrada
    filaDeFamilia: [8, 7, 6, 5, 4, 3, 2, 1],   // familia 1..8 → fila del Akai (8 = arriba)
    asignarConNota: true,           // en modo asignación, la primera nota que entra se asigna al pad elegido

    // Hydra
    salida: null,                   // se fija con V.salida(o0)
    buffers: ['o1', 'o2'],          // buffers para cortar la cadena cuando se vuelve pesada
    memoria: 'o3',                  // buffer del módulo 'congelar' (null = sin congelar)
    copiasMax: 4,                   // cuántas copias de la cadena aguanta antes de pasarla a un buffer

    hud: true,                      // cuadro con la cadena abajo a la izquierda (sólo con GP_tools cargado)
  }
  const copiaDefaults = () => JSON.parse(JSON.stringify(DEFAULTS))
  const C = copiaDefaults()
  V.C = C
  V.DEFAULTS = DEFAULTS

  // ============================================================
  // Reloj: clock MIDI (o tempo propio)
  // ============================================================
  const R = window._perdidoReloj || (window._perdidoReloj = { ticks: 0, tUltimo: -1e9, periodo: 1000 / (70 / 60 * 24), libre: 0 })
  const hayClock = () => performance.now() - R.tUltimo < 1000
  const bpmActual = () => hayClock() ? Math.max(30, Math.min(240, 60000 / (R.periodo * 24))) : C.bpm
  const negras = () => {
    if (hayClock()) return (R.ticks + Math.min(1, (performance.now() - R.tUltimo) / R.periodo)) / 24
    return R.libre
  }
  V.negras = negras
  V.bpm = bpmActual

  // ============================================================
  // Catálogo de módulos
  //   fx(e, p): e() da una copia NUEVA de la imagen que entra (en Hydra cada cadena
  //   se usa una sola vez, por eso es una función). copias = cuántas veces llama a e().
  //   p.k() fuerza (fader) · p.m() fuerza con la música · p.g() golpe (se apaga solo)
  //   p.s() azar -1..1 por golpe · p.r() azar 0..1 por golpe · p.n() altura de la nota 0..1
  //   p.t() negras · p.fase() avanza con la fuerza · fb() = último cuadro de la salida
  // ============================================================
  const fb = () => src(V._out || o0)
  const amtFB = p => () => Math.min(0.93, p.m() * 0.88 + p.g() * 0.06)

  const FAMILIAS = [
    { id: 'desplaza', nombre: 'desplazamiento', variantes: [
      { id: 'corre', copias: 1, fx: (e, p) => e()
          .scrollX(() => p.m() * 0.35 * Math.sin(p.t() * PI / 8) + p.g() * 0.15 * p.s()) },
      { id: 'rueda', copias: 1, fx: (e, p) => e()
          .scrollY(() => p.fase() * 0.5 + p.g() * 0.1 * p.s()) },
      { id: 'repite', copias: 1, fx: (e, p) => e()
          .repeat(() => 1 + Math.round(p.m() * 3), () => 1 + Math.round(p.m() * 3), () => p.g() * 0.5 * p.s(), 0) },
      { id: 'franjas', copias: 1, fx: (e, p) => e()
          .modulateScrollX(osc(() => 6 + Math.floor(p.r() * 24), 0, 0).rotate(PI / 2).thresh(0.5, 0.01),
                           () => p.m() * 0.2 + p.g() * 0.2 * p.s()) },
    ] },
    { id: 'feedback', nombre: 'feedback', variantes: [
      { id: 'tunel', copias: 1, fx: (e, p) => e()
          .blend(fb().scale(() => 1.01 + 0.04 * p.m()), amtFB(p)) },
      { id: 'giro', copias: 1, fx: (e, p) => e()
          .blend(fb().scale(1.004).rotate(() => (0.01 + 0.05 * p.m()) * (p.s() < 0 ? -1 : 1)), amtFB(p)) },
      { id: 'deriva', copias: 1, fx: (e, p) => e()
          .blend(fb().scroll(() => 0.008 * Math.cos(p.r() * 2 * PI), () => 0.008 * Math.sin(p.r() * 2 * PI)), amtFB(p)) },
      { id: 'sandin', copias: 1, fx: (e, p) => e()
          .blend(fb().scale(1.015).hue(() => 0.02 + 0.06 * p.m()).saturate(1.05), amtFB(p)) },
    ] },
    { id: 'color', nombre: 'color', variantes: [
      { id: 'colorama', copias: 1, fx: (e, p) => e().colorama(() => p.m() * 0.3 + p.g() * 0.1) },
      { id: 'tono', copias: 1, fx: (e, p) => e()
          .hue(() => p.k() * (0.5 + 0.5 * Math.sin(p.t() * PI / 16)) + p.g() * 0.25 + p.n() * 0.2) },
      { id: 'poster', copias: 1, fx: (e, p) => e().posterize(() => 2 + (1 - p.m()) * 30, 0.6) },
      { id: 'invierte', copias: 1, fx: (e, p) => e().invert(() => Math.min(p.k(), p.g() * 1.2)) },
      { id: 'satura', copias: 1, fx: (e, p) => e().saturate(() => 1 + p.m() * 5).contrast(() => 1 + p.m() * 0.6) },
      { id: 'canales', copias: 1, fx: (e, p) => e()
          .shift(() => p.m() * 0.4, () => p.m() * 0.2 * p.s(), () => p.g() * 0.3, 0) },
    ] },
    { id: 'contorno', nombre: 'contorno / umbral', variantes: [
      { id: 'umbral', copias: 2, fx: (e, p) => e()
          .blend(e().thresh(() => 0.5 + 0.2 * p.s() * p.g(), 0.02), () => p.m()) },
      { id: 'bordes', copias: 3, fx: (e, p) => e()
          .blend(e().diff(e().scroll(() => 0.002 + 0.004 * p.m(), 0.002)).saturate(0).color(5, 5, 5), () => p.m()) },
      { id: 'recorte', copias: 2, fx: (e, p) => e()
          .mult(e().thresh(() => p.m() * 0.75, 0.05)) },
      { id: 'contraste', copias: 1, fx: (e, p) => e().contrast(() => 1 + p.m() * 6) },
    ] },
    { id: 'simetria', nombre: 'simetría / mosaico', variantes: [
      { id: 'espejo', copias: 2, fx: (e, p) => e().blend(e().kaleid(2).rotate(() => p.fase() * 0.2), () => p.m()) },
      { id: 'tres', copias: 2, fx: (e, p) => e().blend(e().kaleid(3).rotate(() => p.fase() * 0.2), () => p.m()) },
      { id: 'cuatro', copias: 2, fx: (e, p) => e().blend(e().kaleid(4).rotate(() => p.fase() * 0.2), () => p.m()) },
      { id: 'ocho', copias: 2, fx: (e, p) => e().blend(e().kaleid(8).rotate(() => p.fase() * 0.2), () => p.m()) },
    ] },
    { id: 'deforma', nombre: 'deformación', variantes: [
      { id: 'ondas', copias: 1, fx: (e, p) => e().modulate(osc(() => 3 + p.n() * 20, 0.05, 0), () => p.m() * 0.25) },
      { id: 'ruido', copias: 1, fx: (e, p) => e().modulate(noise(() => 2 + p.r() * 4, 0.2), () => p.m() * 0.3) },
      { id: 'remolino', copias: 1, fx: (e, p) => e().modulateRotate(osc(2, 0.05, 0), () => p.m() * 1.2) },
      { id: 'lente', copias: 1, fx: (e, p) => e().modulateScale(osc(3, 0.1, 0), () => p.m() * 1.5) },
      { id: 'arrastre', copias: 1, fx: (e, p) => e().modulate(fb(), () => p.m() * 0.15) },
    ] },
    { id: 'glitch', nombre: 'glitch', variantes: [
      { id: 'saltos', copias: 1, fx: (e, p) => e()
          .scroll(() => p.g() * 0.3 * p.s(), () => p.g() * 0.08 * (p.r() < 0.5 ? -1 : 1)) },
      { id: 'bloques', copias: 1, fx: (e, p) => e()
          .pixelate(() => lerp(1500, 8 + p.r() * 40, p.g()), () => lerp(1500, 6 + p.r() * 30, p.g())) },
      { id: 'rasgado', copias: 1, fx: (e, p) => e()
          .modulateScrollX(osc(() => 8 + p.r() * 40, 0, 0).rotate(PI / 2).thresh(0.6, 0.01), () => p.g() * 0.4 * p.s())
          .scrollY(() => p.g() * 0.05 * p.s()) },
      { id: 'canales', copias: 2, fx: (e, p) => e().color(1, 0, 0).scrollX(() => p.g() * 0.06 * p.s() + p.m() * 0.01)
          .add(e().color(0, 1, 1).scrollX(() => -(p.g() * 0.06 * p.s() + p.m() * 0.01))) },
      { id: 'vhs', copias: 1, fx: (e, p) => e()
          .modulateScrollX(noise(() => 30 + p.r() * 30, 0.5), () => p.m() * 0.015 + p.g() * 0.05)
          .mult(osc(300, 0, 0).rotate(PI / 2), () => p.m() * 0.6)
          .saturate(() => 1 + p.m() * 0.5) },
    ] },
    { id: 'estela', nombre: 'persistencia / estelas', variantes: [
      { id: 'estela', copias: 1, fx: (e, p) => e().blend(fb(), () => Math.min(0.95, p.m() * 0.92)) },
      { id: 'luz', copias: 1, fx: (e, p) => e().add(fb().color(0.8, 0.8, 0.8), () => p.m() * 0.6) },
      { id: 'congelar', copias: 1, memoria: true, fx: (e, p) => e().blend(src(V._mem || o3), () => p.k()) },
      { id: 'movimiento', copias: 2, fx: (e, p) => e().blend(e().diff(fb()).color(2, 2, 2), () => p.m()) },
    ] },
  ]
  const famIdx = id => FAMILIAS.findIndex(f => f.id === id)
  const varIdx = (f, v) => {
    if (typeof v === 'number') return ((v % FAMILIAS[f].variantes.length) + FAMILIAS[f].variantes.length) % FAMILIAS[f].variantes.length
    const i = FAMILIAS[f].variantes.findIndex(x => x.id === v)
    return i < 0 ? 0 : i
  }
  V.FAMILIAS = FAMILIAS

  // ============================================================
  // Estado de las columnas y de los pads
  // ============================================================
  const NOMBRES_ENTRADA = () => Object.keys(C.entradas)
  const cols = Array.from({ length: 8 }, (_, i) => ({
    i, fam: -1, var: 0, modo: 'T', entrada: null,
    int: 0.5, env: 0, autoEnv: 0, r: 0.5, s: 0, nota: 0.5, fase: 0, captura: 0, autoUlt: -1,
  }))
  V._cols = cols

  // lo que recuerda cada pad (variante y entrada), se guarda en el navegador
  const PADS_KEY = 'GP_perdido_pads_v1'
  const pads = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ var: 0, entrada: null })))
  try {
    const g = JSON.parse(localStorage.getItem(PADS_KEY) || 'null')
    if (g) g.forEach((fila, f) => fila.forEach((pd, c) => { if (pads[f] && pads[f][c]) Object.assign(pads[f][c], pd) }))
  } catch (_) {}
  const guardarPads = () => { try { localStorage.setItem(PADS_KEY, JSON.stringify(pads)) } catch (_) {} }

  // entradas MIDI: prendida / apagada, si llegó algo, notas sostenidas
  const INP = window._perdidoEntradas || (window._perdidoEntradas = {})
  const inp = n => INP[n] || (INP[n] = { on: true, visto: false, held: new Map(), vel: 0 })

  // parámetros de cada columna (funciones que Hydra lee en cada cuadro)
  const P = cols.map(col => {
    const p = {}
    p.int = () => col.int
    p.k = () => col.modo === 'M' ? 1 : col.int
    p.m = () => p.k() * (col.entrada ? (C.reposo + (1 - C.reposo) * col.env) : 1)
    p.g = () => p.k() * (col.entrada ? col.env : col.autoEnv)
    p.e = () => col.entrada ? col.env : col.autoEnv
    p.r = () => col.r
    p.s = () => col.s
    p.n = () => col.nota
    p.t = () => negras()
    p.fase = () => col.fase
    return p
  })

  // ============================================================
  // Cadena ↔ texto (lo que guardan los estados)
  // ============================================================
  const textoDeCol = col => {
    if (col.fam < 0) return '-'
    const f = FAMILIAS[col.fam]
    return `${f.id}.${f.variantes[col.var].id}@${col.entrada || '-'}`
  }
  const leerEntrada = (txt) => {
    const m = /^\s*([a-z]+)(?:\.([a-z0-9]+))?(?:@([a-z-]+))?\s*$/i.exec(String(txt || '-'))
    if (!m || txt === '-' || m[1] === '-') return null
    const f = famIdx(m[1].toLowerCase())
    if (f < 0) { console.warn(`[GP perdido] familia "${m[1]}" no existe (${FAMILIAS.map(x => x.id).join(', ')})`); return null }
    const v = m[2] == null ? null : /^\d+$/.test(m[2]) ? Number(m[2]) : m[2].toLowerCase()
    if (typeof v === 'string' && !FAMILIAS[f].variantes.some(x => x.id === v)) {
      console.warn(`[GP perdido] ${FAMILIAS[f].id}: variante "${v}" no existe (${FAMILIAS[f].variantes.map(x => x.id).join(', ')})`)
    }
    let ent
    if (m[3] != null) {
      ent = m[3] === '-' ? null : m[3].toLowerCase()
      if (ent && !C.entradas[ent]) { console.warn(`[GP perdido] entrada "${ent}" no existe (${NOMBRES_ENTRADA().join(', ')})`); ent = null }
    }
    return { f, v, ent }
  }

  let aplicado = { cadena: null, modo: null, video: null, encuadre: null }
  const firma = () => JSON.stringify([C.cadena, C.modo, C.video, C.encuadre])
  let ultimaFirma = ''

  // texto de C → columnas
  const aplicarCadena = () => {
    const lista = Array.isArray(C.cadena) ? C.cadena : String(C.cadena).split(/\s+/)
    const modo = String(C.modo || '').toUpperCase()
    for (let i = 0; i < 8; i++) {
      const col = cols[i]
      const x = leerEntrada(lista[i])
      col.modo = modo[i] === 'M' ? 'M' : 'T'
      if (!x) { col.fam = -1; continue }
      const pad = pads[x.f][i]
      col.fam = x.f
      col.var = x.v == null ? varIdx(x.f, pad.var) : varIdx(x.f, x.v)
      if (x.ent !== undefined) pad.entrada = x.ent
      pad.var = col.var
      col.entrada = pad.entrada
    }
    guardarPads()
  }
  // columnas → texto en C (así una captura de estados lo guarda)
  const escribirCadena = () => {
    C.cadena = cols.map(textoDeCol)
    C.modo = cols.map(c => c.modo).join('')
    ultimaFirma = firma()
  }

  // ============================================================
  // Hydra: armar la cadena
  // ============================================================
  const salidaDe = x => typeof x === 'string' ? window[x] : x
  const fuenteDe = n => window['s' + Math.max(0, Math.min(3, n | 0))]

  const aspecto = () => {
    const s = fuenteDe(C.video)
    const v = s && s.src
    const vw = v && (v.videoWidth || v.width), vh = v && (v.videoHeight || v.height)
    const W = (typeof width !== 'undefined' && width) || 1280, H = (typeof height !== 'undefined' && height) || 720
    return vw && vh ? (vw / vh) / (W / H) : 1     // < 1: el video es más angosto que la pantalla
  }
  const fuente = () => {
    const s = src(fuenteDe(C.video))
    if (C.encuadre === 'estirar') return s
    const a = aspecto()
    if (C.encuadre === 'repetir') return s.scale(1, Math.min(1, a), Math.min(1, 1 / a))
    return s.scale(1, Math.max(1, a), Math.max(1, 1 / a))      // llenar
  }

  let errores = 0
  const compilar = () => {
    if (typeof src !== 'function') { console.warn('[GP perdido] Hydra no está cargado'); return }
    const salida = V._out || o0
    const libres = (C.buffers || []).map(salidaDe).filter(Boolean)
    const mem = C.memoria ? salidaDe(C.memoria) : null
    V._mem = mem
    let fab = fuente
    let mult = 1
    let memUsada = false
    const cortes = []
    try {
      for (let i = 0; i < 8; i++) {
        const col = cols[i]
        if (col.fam < 0) continue
        let mod = FAMILIAS[col.fam].variantes[col.var]
        if (mod.memoria && (memUsada || !mem)) {
          // un solo 'congelar' a la vez (hay un solo buffer de memoria): los demás hacen estela
          mod = FAMILIAS[col.fam].variantes[0]
          console.info(`[GP perdido] etapa ${i + 1}: ya hay un 'congelar' en la cadena, ésta hace 'estela'`)
        }
        const necesita = mod.copias + (col.modo === 'M' ? 1 : 0) + (mod.memoria ? 1 : 0)
        if (mult * necesita > C.copiasMax && libres.length) {
          const o = libres.shift()
          const previa = fab
          previa().out(o)
          cortes.push(`${o.label || 'buffer'} antes de la etapa ${i + 1}`)
          fab = () => src(o)
          mult = 1
        }
        mult *= necesita
        const entrada = fab
        const p = P[i]
        if (mod.memoria) {
          memUsada = true
          // la memoria copia lo que entra a esta etapa cada vez que hay un golpe
          src(mem).blend(entrada(), () => col.captura > 0 ? 1 : 0).out(mem)
        }
        if (col.modo === 'M') fab = () => entrada().blend(mod.fx(entrada, p), () => col.int)
        else fab = () => mod.fx(entrada, p)
      }
      fab().out(salida)
      for (const o of libres) solid(0, 0, 0, 1).out(o)          // los buffers que sobran no gastan
      if (mem && !memUsada) solid(0, 0, 0, 1).out(mem)
      V._cortes = cortes
      errores = 0
    } catch (err) {
      if (errores++ < 3) console.error('[GP perdido] no pude armar la cadena:', err)
      try { fuente().out(salida) } catch (_) {}
    }
  }
  V.compilar = compilar

  const cambio = () => {
    escribirCadena()
    compilar()
    pintarTodo()
  }

  // ============================================================
  // Videos (hasta 4, uno por fuente s0..s3)
  // ============================================================
  const cargados = window._perdidoVideos || (window._perdidoVideos = [])
  const cargarVideos = () => {
    (C.videos || []).slice(0, 4).forEach((url, i) => {
      const s = fuenteDe(i)
      if (!s || !url) return
      if (cargados[i] === url && s.src) { try { s.src.playbackRate = C.velVideo } catch (_) {} return }
      cargados[i] = url
      try {
        const antes = s.src
        s.initVideo(url)
        // Hydra recién cambia s.src cuando el video ya tiene imagen: esperamos a ese momento
        // para ajustar la velocidad y el encuadre (que depende de la forma del video)
        const t0 = performance.now()
        const esperar = () => {
          const v = s.src
          if (v && v !== antes && v.videoWidth) {
            try { v.playbackRate = C.velVideo } catch (_) {}
            console.info(`[GP perdido] video ${i + 1} listo (${v.videoWidth}×${v.videoHeight})`)
            if (i === (C.video | 0)) compilar()
            return
          }
          if (performance.now() - t0 > 30000) { console.warn(`[GP perdido] el video ${i + 1} no cargó: ${url}`); return }
          setTimeout(esperar, 200)
        }
        setTimeout(esperar, 200)
      } catch (err) { console.warn(`[GP perdido] video ${i + 1}:`, err) }
    })
  }
  V.video = (n) => {
    const total = Math.max(1, Math.min(4, (C.videos || []).length))
    C.video = ((n | 0) % total + total) % total
    ultimaFirma = firma()
    compilar()
    console.info(`[GP perdido] video ${C.video + 1}`)
    return V
  }

  // ============================================================
  // LEDs del Akai (todo pasa por GP.midi.luz)
  // ============================================================
  const M = () => GP.midi || null
  const COLOR = () => (GP.midi && GP.midi.COLOR) || { apagado: 0, verde: 1, verdeParpadeo: 2, rojo: 3, rojoParpadeo: 4, amarillo: 5, amarilloParpadeo: 6 }
  const valorLed = nombre => typeof nombre === 'number' ? nombre : (COLOR()[nombre] ?? 0)
  const notaPad = (f, c) => (C.filaDeFamilia[f] - 1) * 8 + c
  const padDeNota = n => {
    const fila = Math.floor(n / 8) + 1, c = n % 8
    const f = C.filaDeFamilia.indexOf(fila)
    return f < 0 ? null : { f, c }
  }
  const ledEntrada = ent => ent && C.entradas[ent] ? valorLed(C.entradas[ent].led) : valorLed(C.ledSinEntrada)

  const A = window._perdidoAkai || (window._perdidoAkai = { asignar: false, armado: null, shift: false, shiftUsado: false, shiftT: 0 })
  const apagadoHasta = {}       // nota → hasta cuándo queda apagada (actividad)
  const timers = {}

  const valorPad = (f, c) => {
    const n = notaPad(f, c)
    if (A.asignar) {
      if (A.armado && A.armado.f === f && A.armado.c === c) return valorLed(C.ledArmado)
      const ent = pads[f][c].entrada
      return ent ? ledEntrada(ent) : 0
    }
    const col = cols[c]
    if (col.fam !== f) return 0
    if (performance.now() < (apagadoHasta[n] || 0)) return 0
    return ledEntrada(col.entrada)
  }
  const pintarPad = (f, c) => { const m = M(); if (m && m.luz) m.luz(notaPad(f, c), valorPad(f, c) || null) }
  const pintarGrilla = () => { for (let f = 0; f < 8; f++) for (let c = 0; c < 8; c++) pintarPad(f, c) }

  // botones de abajo (64-71): apagado = bypass · prendido = transformación · parpadea = mezcla
  const pintarColumna = (c, aviso) => {
    const m = M(); if (!m || !m.luz) return
    const col = cols[c]
    const v = col.fam < 0 ? 0 : col.modo === 'M' ? 2 : 1
    if (aviso) {
      m.luz(64 + c, v === 1 ? null : 1)
      clearTimeout(timers['b' + c])
      timers['b' + c] = setTimeout(() => m.luz(64 + c, v || null), 140)
      return
    }
    m.luz(64 + c, v || null)
  }
  // botones de la derecha (82-85): apagado = no llegó nada · prendido = recibe · parpadea = apagada · 86 asignación
  const pintarEntrada = (nombre, flash) => {
    const m = M(); if (!m || !m.luz) return
    const d = C.entradas[nombre]; if (!d || d.boton == null) return
    const e = inp(nombre)
    const v = !e.on ? 2 : e.visto ? 1 : 0
    if (flash && v === 1) {
      m.luz(d.boton, null)
      clearTimeout(timers['e' + nombre])
      timers['e' + nombre] = setTimeout(() => m.luz(d.boton, 1), C.actividadMs)
      return
    }
    m.luz(d.boton, v || null)
  }
  const pintarAsignar = () => { const m = M(); if (m && m.luz) m.luz(86, A.asignar ? 2 : null) }

  const pintarTodo = () => {
    pintarGrilla()
    for (let c = 0; c < 8; c++) pintarColumna(c)
    NOMBRES_ENTRADA().forEach(n => pintarEntrada(n))
    pintarAsignar()
    pintarHud()
  }
  V.pintar = pintarTodo

  // actividad: el pad se apaga un instante cuando suena su entrada
  const actividad = (c) => {
    const col = cols[c]
    if (col.fam < 0 || A.asignar) return
    const n = notaPad(col.fam, c)
    apagadoHasta[n] = performance.now() + C.actividadMs
    pintarPad(col.fam, c)
    clearTimeout(timers['p' + c])
    timers['p' + c] = setTimeout(() => { if (cols[c].fam >= 0) pintarPad(cols[c].fam, c) }, C.actividadMs + 5)
  }

  // ============================================================
  // Música: notas de las entradas
  // ============================================================
  const entradaDeCanal = (canal1) => NOMBRES_ENTRADA().find(n => C.entradas[n].canal === canal1) || null
  const alturaDe = (d, nota) => d.rango ? clamp01((nota - d.rango[0]) / Math.max(1, d.rango[1] - d.rango[0])) : nota / 127

  const golpear = (c, nivel, nota, d) => {
    const col = cols[c]
    col.env = Math.max(col.env, nivel)
    col.r = Math.random()
    col.s = Math.random() * 2 - 1
    if (nota != null && d) col.nota = alturaDe(d, nota)
    col.captura = 2
  }

  const notaEntrada = (nombre, nota, vel, on) => {
    const d = C.entradas[nombre]
    const e = inp(nombre)
    if (!e.visto) { e.visto = true; pintarEntrada(nombre) }
    if (on && A.asignar && A.armado && C.asignarConNota) { asignarArmado(nombre); return }
    if (!e.on) return
    if (!on) { e.held.delete(nota); return }
    const v = Math.max(0.4, vel / 127)
    const acento = d.acento && d.acento.includes(nota)
    const nivel = acento ? v * (d.nivelAcento ?? 0.7) : v
    if (!d.acento) e.held.set(nota, v)
    for (let c = 0; c < 8; c++) {
      if (cols[c].entrada !== nombre) continue
      golpear(c, nivel, nota, d)
      actividad(c)
    }
    pintarEntrada(nombre, true)
  }
  V.golpe = (nombre = 'bateria', nota, vel = 110) => {
    const d = C.entradas[nombre]
    if (!d) { console.warn(`[GP perdido] entrada "${nombre}" no existe`); return V }
    const n = nota ?? (d.rango ? Math.round((d.rango[0] + d.rango[1]) / 2) : 37)
    notaEntrada(nombre, n, vel, true)
    setTimeout(() => notaEntrada(nombre, n, 0, false), 150)
    return V
  }

  // ============================================================
  // Akai
  // ============================================================
  const tocarPad = (f, c) => {
    if (A.asignar) {
      A.armado = A.armado && A.armado.f === f && A.armado.c === c ? null : { f, c }
      pintarGrilla()
      pintarHud()
      return
    }
    const col = cols[c]
    if (col.fam === f) { col.fam = -1 }                                          // pad prendido → bypass
    else { col.fam = f; col.var = varIdx(f, pads[f][c].var); col.entrada = pads[f][c].entrada }
    cambio()
  }

  const asignarArmado = (nombre) => {
    if (!A.armado) return
    const { f, c } = A.armado
    const pad = pads[f][c]
    pad.entrada = pad.entrada === nombre ? null : nombre                          // misma entrada otra vez = sacarla
    if (cols[c].fam === f) cols[c].entrada = pad.entrada
    console.info(`[GP perdido] ${FAMILIAS[f].id} · columna ${c + 1} → ${pad.entrada || 'sin entrada'}`)
    A.armado = null
    guardarPads()
    escribirCadena()
    pintarGrilla()
    pintarHud()
  }

  const siguienteVariante = (c, paso = 1) => {
    const col = cols[c]
    if (col.fam < 0) return
    col.var = varIdx(col.fam, col.var + paso)
    pads[col.fam][c].var = col.var
    guardarPads()
    cambio()
    pintarColumna(c, true)
    console.info(`[GP perdido] columna ${c + 1}: ${FAMILIAS[col.fam].id} · ${FAMILIAS[col.fam].variantes[col.var].id}`)
  }

  const alternarModo = (c, modo) => {
    const col = cols[c]
    col.modo = modo || (col.modo === 'M' ? 'T' : 'M')
    cambio()
    console.info(`[GP perdido] columna ${c + 1}: ${col.modo === 'M' ? 'mezcla' : 'transformación'}`)
  }

  let diag = false
  const akai = (data) => {
    const [st, d1, d2] = data
    const tipo = st & 0xf0
    const on = tipo === 0x90 && d2 > 0
    const off = tipo === 0x80 || (tipo === 0x90 && d2 === 0)
    if (diag) {
      const que = tipo === 0xb0 ? `fader CC ${d1} = ${d2}`
        : d1 <= 63 ? `pad nota ${d1} (fila ${Math.floor(d1 / 8) + 1}, columna ${d1 % 8 + 1})`
        : d1 <= 71 ? `botón de abajo ${d1} (columna ${d1 - 63})`
        : d1 >= 82 && d1 <= 89 ? `botón de la derecha ${d1}` : d1 === 98 ? 'SHIFT' : `nota ${d1}`
      console.log(`[Akai] ${on ? 'on ' : off ? 'off' : '   '} ${que}  · [${[...data].join(', ')}]`)
    }
    if (d1 === 98 && (on || off)) {
      if (on) { A.shift = true; A.shiftUsado = false; A.shiftT = performance.now() }
      else {
        A.shift = false
        if (!A.shiftUsado && performance.now() - A.shiftT < 400) V.toggleCodigo()
      }
      return
    }
    if (!on) return
    if (A.shift) A.shiftUsado = true
    if (d1 <= 63) { const pd = padDeNota(d1); if (pd) tocarPad(pd.f, pd.c); return }
    if (d1 >= 64 && d1 <= 71) { const c = d1 - 64; if (A.shift) alternarModo(c); else siguienteVariante(c); return }
    if (d1 === 86) { A.asignar = !A.asignar; A.armado = null; pintarTodo(); console.info(`[GP perdido] modo asignación ${A.asignar ? 'PRENDIDO: elegí un pad y después la entrada' : 'apagado'}`); return }
    const ent = NOMBRES_ENTRADA().find(n => C.entradas[n].boton === d1)
    if (ent) {
      if (A.shift) { V.video(NOMBRES_ENTRADA().indexOf(ent)); return }
      if (A.asignar && A.armado) { asignarArmado(ent); return }
      const e = inp(ent)
      e.on = !e.on
      if (!e.on) e.held.clear()
      pintarEntrada(ent)
      console.info(`[GP perdido] entrada ${ent} ${e.on ? 'prendida' : 'APAGADA'}`)
    }
  }

  // todo lo que entra por MIDI (llamar desde GP.midi.alMensaje)
  const esAkai = nombre => (GP.midi && GP.midi.config ? GP.midi.config.akai : /apc|akai_?ensayo/i).test(nombre)
  V.midi = (nombre, data) => {
    const st = data[0]
    if (st === 0xfa) { R.ticks = 0; R.tUltimo = performance.now(); return }
    if (st === 0xf8) {
      const ahora = performance.now()
      const d = ahora - R.tUltimo
      if (d > 5 && d < 200) R.periodo += (d - R.periodo) * 0.1
      R.tUltimo = ahora
      R.ticks++
      return
    }
    if (st >= 0xf0) return
    if (esAkai(nombre)) { if ((st & 0x0f) === 0) akai(data); return }
    const tipo = st & 0xf0
    if (tipo !== 0x90 && tipo !== 0x80) return
    const canal = (st & 0x0f) + 1
    if (GP.estados && GP.estados.esCanalEstados && GP.estados.esCanalEstados(nombre, canal)) return
    const ent = entradaDeCanal(canal)
    if (!ent) return
    notaEntrada(ent, data[1], data[2], tipo === 0x90 && data[2] > 0)
  }

  // ============================================================
  // Cada cuadro
  // ============================================================
  let tUlt = performance.now()
  V.update = () => {
    const ahora = performance.now()
    const dt = Math.min(0.1, Math.max(0, (ahora - tUlt) / 1000))
    tUlt = ahora
    const negra = 60 / bpmActual()
    if (!hayClock()) R.libre += dt / negra
    const nb = negras()

    // cambios que llegan de afuera (estados, Ctrl+Enter) → re-armar
    const fz = firma()
    if (fz !== ultimaFirma) {
      const videoAntes = aplicado.video
      aplicarCadena()
      escribirCadena()
      aplicado.video = C.video
      compilar()
      pintarTodo()
      if (videoAntes !== C.video) console.info(`[GP perdido] video ${(C.video | 0) + 1}`)
    }

    for (let c = 0; c < 8; c++) {
      const col = cols[c]
      const v = C['f' + (c + 1)]
      col.int = clamp01(typeof v === 'number' ? v : 0.5)
      // golpe de la entrada: se apaga solo; bajo y melodía se sostienen mientras suena la nota
      if (col.entrada) {
        const d = C.entradas[col.entrada]
        const e = inp(col.entrada)
        const caida = Math.max(0.02, (d && d.caida) || 0.5) * negra
        col.env *= Math.exp(-dt / caida)
        if (d && e.on && e.held.size && !d.acento) col.env = Math.max(col.env, C.sostenido * Math.max(...e.held.values()))
      } else {
        col.env = 0
        // sin entrada: un golpe propio con el tempo
        if (C.pulsoAuto > 0) {
          const k = Math.floor(nb / C.pulsoAuto)
          if (k !== col.autoUlt) { col.autoUlt = k; col.autoEnv = 1; col.r = Math.random(); col.s = Math.random() * 2 - 1; col.captura = 2 }
        }
      }
      col.autoEnv *= Math.exp(-dt / Math.max(0.02, C.caidaAuto * negra))
      col.fase += dt / negra * P[c].m() * 0.25
      if (col.captura > 0) col.captura--
    }
    if (ahora - hudT > 150) pintarHud()
  }

  // golpe a todas las etapas (cambio de estado)
  V.alEntrarEstado = () => {
    if (!C.golpeAlCambiar) return
    for (let c = 0; c < 8; c++) { cols[c].env = 1; cols[c].autoEnv = 1; cols[c].r = Math.random(); cols[c].s = Math.random() * 2 - 1; cols[c].captura = 2 }
  }

  // ============================================================
  // HUD (fuera del canvas: no sale en la proyección ni en el video grabado)
  // ============================================================
  let hud = null, hudT = 0
  const pintarHud = () => {
    hudT = performance.now()
    if (typeof document === 'undefined') return
    const visible = C.hud && GP.tools && codigoVisible
    if (!visible) { if (hud) hud.style.display = 'none'; return }
    if (!hud || !document.body.contains(hud)) {
      hud = document.getElementById('gpPerdidoHud') || document.createElement('div')
      hud.id = 'gpPerdidoHud'
      hud.style.cssText = 'position:fixed; left:8px; bottom:8px; z-index:2147483646; background:rgba(0,0,0,0.72); color:#ddd; font:11px/1.45 monospace; padding:6px 9px; border-radius:4px; white-space:pre; pointer-events:none;'
      document.body.appendChild(hud)
    }
    hud.style.display = ''
    const lineas = cols.map((col, c) => {
      const n = `${c + 1}`
      if (col.fam < 0) return `${n}  ·  bypass`
      const f = FAMILIAS[col.fam]
      const barra = '▮'.repeat(Math.round(col.int * 8)).padEnd(8, '·')
      const pulso = (col.entrada ? col.env : col.autoEnv) > 0.4 ? '●' : ' '
      return `${n} ${col.modo} ${(f.id + ' · ' + f.variantes[col.var].id).padEnd(21)} ${barra} ${pulso} ${col.entrada || 'sola'}`
    })
    const entradas = NOMBRES_ENTRADA().map(nm => `${nm}${inp(nm).on ? '' : ' (apagada)'}`).join(' · ')
    const cab = `PERDIDO · video ${(C.video | 0) + 1} · ${Math.round(bpmActual())} bpm${hayClock() ? ' (clock)' : ''}${A.asignar ? '  · ASIGNACIÓN' + (A.armado ? ` → ${FAMILIAS[A.armado.f].id} col ${A.armado.c + 1}: tocá 82-85` : ': elegí un pad') : ''}`
    hud.textContent = [cab, ...lineas, entradas].join('\n')
  }

  // ---- ocultar código y paneles para el show (SHIFT solo) ----
  let codigoVisible = true
  V.toggleCodigo = () => {
    codigoVisible = !codigoVisible
    const partes = ['.CodeMirror', '#editor-container', '#toolbar', '#menu', '#info-container', '#modal']
    document.querySelectorAll(partes.join(',')).forEach(el => { el.style.visibility = codigoVisible ? '' : 'hidden' })
    if (GP.tools && GP.tools.paneles) GP.tools.paneles(codigoVisible)
    pintarHud()
  }

  // ============================================================
  // API
  // ============================================================
  V.init = (config = {}) => {
    const limpio = copiaDefaults()
    for (const k of Object.keys(C)) if (!(k in limpio)) delete C[k]
    Object.assign(C, limpio, config)
    if (config.entradas) {   // completa cada entrada con lo que falte
      C.entradas = {}
      for (const [k, d] of Object.entries(config.entradas)) C.entradas[k] = { ...(DEFAULTS.entradas[k] || {}), ...d }
    }
    cargarVideos()
    aplicarCadena()
    escribirCadena()
    aplicado.video = C.video
    return V
  }

  V.salida = (out) => {
    V._out = out
    compilar()
    pintarTodo()
    return V
  }

  const col0 = n => { const c = (n | 0) - 1; if (c < 0 || c > 7) throw new Error('columna de 1 a 8'); return c }
  V.poner = (n, familia, variante, { entrada, modo } = {}) => {
    const c = col0(n), f = famIdx(familia)
    if (f < 0) { console.warn(`[GP perdido] familias: ${FAMILIAS.map(x => x.id).join(', ')}`); return V }
    const col = cols[c]
    col.fam = f
    col.var = varIdx(f, variante ?? pads[f][c].var)
    pads[f][c].var = col.var
    if (entrada !== undefined) pads[f][c].entrada = entrada && C.entradas[entrada] ? entrada : null
    col.entrada = pads[f][c].entrada
    if (modo) col.modo = String(modo).toUpperCase() === 'M' ? 'M' : 'T'
    guardarPads()
    cambio()
    return V
  }
  V.quitar = n => { cols[col0(n)].fam = -1; cambio(); return V }
  V.variante = (n, paso = 1) => { siguienteVariante(col0(n), paso); return V }
  V.modo = (n, m) => { alternarModo(col0(n), m ? (String(m).toUpperCase() === 'M' ? 'M' : 'T') : null); return V }
  V.asignar = (n, entrada) => {
    const c = col0(n), col = cols[c]
    if (col.fam < 0) { console.warn('[GP perdido] esa columna está en bypass'); return V }
    pads[col.fam][c].entrada = entrada && C.entradas[entrada] ? entrada : null
    col.entrada = pads[col.fam][c].entrada
    guardarPads(); escribirCadena(); pintarGrilla(); pintarHud()
    return V
  }
  V.entrada = (nombre, on) => { const e = inp(nombre); e.on = on == null ? !e.on : !!on; if (!e.on) e.held.clear(); pintarEntrada(nombre); return V }
  // al pasar a otra canción: apaga las luces que prendió Perdido (grilla, 64-71, 82-86)
  V.apagar = () => {
    const m = M(); if (!m || !m.luz) return V
    for (let n = 0; n <= 71; n++) m.luz(n, null)
    for (let n = 82; n <= 86; n++) m.luz(n, null)
    if (hud) hud.style.display = 'none'
    return V
  }
  V.limpiarPads = () => { pads.forEach(f => f.forEach(pd => { pd.var = 0; pd.entrada = null })); guardarPads(); pintarTodo(); return V }
  V.ver = () => {
    console.table(cols.map((col, c) => col.fam < 0 ? { columna: c + 1, modulo: 'bypass' } : {
      columna: c + 1, familia: FAMILIAS[col.fam].id, variante: FAMILIAS[col.fam].variantes[col.var].id,
      modo: col.modo === 'M' ? 'mezcla' : 'transformación', intensidad: Math.round(col.int * 100) / 100, entrada: col.entrada || 'sola',
    }))
    if (V._cortes && V._cortes.length) console.info(`[GP perdido] cadena cortada en buffers: ${V._cortes.join(' · ')}`)
    return V
  }
  V.catalogo = () => { FAMILIAS.forEach((f, i) => console.log(`fila ${C.filaDeFamilia[i]} · ${f.id.padEnd(9)} → ${f.variantes.map(v => v.id).join(' · ')}`)); return V }
  V.diagnostico = (v = !diag) => { diag = !!v; console.info(`[GP perdido] diagnóstico del Akai ${diag ? 'PRENDIDO (tocá pads, botones y faders)' : 'apagado'}`); return V }
  // pinta cada fila con un valor de LED (0..6 en el mk1; con un mk2 se ve otra cosa)
  V.probarColores = (valores = [0, 1, 2, 3, 4, 5, 6, 0]) => {
    const m = M(); if (!m) return V
    for (let fila = 0; fila < 8; fila++) for (let c = 0; c < 8; c++) m.luz(fila * 8 + c, valores[7 - fila] || null)
    console.info('[GP perdido] fila 8 = valor 0 … fila 2 = valor 6 (verde, verde parpadeo, rojo, rojo parpadeo, amarillo, amarillo parpadeo). GP.perdido.pintar() vuelve a la cadena')
    return V
  }

  Object.defineProperty(V, 'asignando', { get: () => A.asignar })
  GP.perdido = V
  console.log('[GP] visual Perdido ' + VERSION + ' (produccion/05_Perdido/arq) cargado')
})()
