// ============================================================
// GP_M-LIVE_v02.js  ·  LIVE/
// MASTER del show (Gordo y Papu) · Fase 3
// Rol: un solo sketch que queda cargado toda la noche y va llamando a cada
//      canción de LIVE/sketches/ sin tocarla. Entre canción y canción limpia
//      todo lo que la anterior dejó puesto (pantalla, update, MIDI, mic, videos).
// Creado: 04/11/2026 (v01: primera versión, para el ensayo general — ver si
//         las 5 canciones cargan bien desde acá y si al ir y volver se ven igual)
//         04/11/2026: recargar pasa de Ctrl+Alt+R a Ctrl+Alt+9 (la R grababa a la vez con GP_tools)
//         06/11/2026 (v02: cartel de la canción arriba al medio · al cambiar de canción se apaga lo de
//         Perdido (cuadro de la cadena y sus luces): necesita el motor de Perdido LIVE-v1.4)
// ============================================================
//
// CÓMO SE USA
//   Pegá este sketch en Hydra y Ctrl+Shift+Enter. Arranca en la canción 1.
//
//   Teclado (funciona aunque el cursor esté en el código):
//     Ctrl+Alt+1 … 5   ir a esa canción
//     Ctrl+Alt+→ / ←   siguiente / anterior
//     Ctrl+Alt+0       negro (limpia y no carga nada)
//     Ctrl+Alt+9       recargar la canción actual (la R es del grabador de GP_tools)
//   En Mac: Control + Option (no Cmd) + la misma tecla
//
//   Consola:
//     GP.master.ir(3)          ir a la canción 3
//     GP.master.siguiente()    GP.master.anterior()
//     GP.master.negro()
//     GP.master.informe()      tabla: cuántas veces cargó cada una, cuánto tardó, errores
//
// QUÉ PROBAR EN EL ENSAYO GENERAL
//   1. Cada canción carga sin errores (cartel verde arriba al medio; si falla, rojo
//      y el error en la consola).
//   2. MIDI, estados (canal 16 / botones 87-88) y FMASTER responden en cada una.
//   3. Ir y volver: 1 → 3 → 1 · 5 → 2 → 5. Si una canción se ve distinta la segunda vez,
//      algo de la anterior no se limpió: anotá cuál venía antes.
//   4. Cuánto tarda cada carga (GP.master.informe()).
//
// LAS CANCIONES NO SE TOCAN
//   El master lee el archivo de cada canción tal cual está en LIVE/sketches/ y lo
//   ejecuta. Sólo le cambia, al vuelo y sin guardar nada:
//     - GP_SHA  → usa el del master (así todo el show sale del mismo commit)
//     - no vuelve a cargar GP_midi / GP_estados / GP_tools (los carga el master una vez)
// ============================================================


// ---- configuración ----
// 'main' = ensayo: lo último que subiste. Para el show: el hash del commit probado
//          (GitHub Desktop → History → clic derecho → Copy SHA).
const GP_SHA = 'main'

// true = ensayo (grabador 89, panel, reproductor con los ensayos de cada canción)
// false = show (no se carga GP_tools)
const CON_TOOLS = true

const CANCIONES = [
  '01_Fluorescente',
  '02_Buscando_Placer',
  '03_Vociferan',
  '04_James',
  '05_Perdido',
]
const CANCION_INICIAL = 1   // 0 = arrancar en negro


// ---- carga de scripts (igual que en las canciones) ----
const urlGP = (ruta) => GP_SHA === 'main'
  ? `https://raw.githubusercontent.com/agustincal/gordoypapu/main/${ruta}?t=${Date.now()}`
  : `https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@${GP_SHA}/${ruta}`

const textoGP = async (ruta) => {
  const res = await fetch(urlGP(ruta), { cache: 'no-store' })
  if (!res.ok) throw new Error(`no encontré ${ruta} (${res.status})`)
  return res.text()
}
const cargarGP = async (ruta) => { (0, eval)(await textoGP(ruta)) }

// lo común, una sola vez
await cargarGP('LIVE/arq/GP_midi.js')
await cargarGP('LIVE/arq/GP_estados.js')
if (CON_TOOLS) await cargarGP('LIVE/arq/GP_tools.js')
await GP.midi.start()


// ============================================================
// MASTER
// ============================================================
;(() => {
  const VERSION = 'v02'
  const viejo = GP.master
  const M = GP.master = {
    _version: VERSION,
    actual: viejo ? viejo.actual : 0,          // 0 = negro · 1..5 = canción
    informeDatos: viejo ? viejo.informeDatos : {},
    cargando: false,
    _arrancado: viejo ? viejo._arrancado : false,
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

  // ---- cartel arriba al medio ----
  let cartel = document.getElementById('gp-master-cartel')
  if (!cartel) {
    cartel = document.createElement('div')
    cartel.id = 'gp-master-cartel'
    document.body.appendChild(cartel)
  }
  Object.assign(cartel.style, {
    position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
    padding: '8px 12px', borderRadius: '6px', font: '600 14px monospace',
    color: '#000', background: '#7CFC00', pointerEvents: 'none',
    transition: 'opacity .4s', opacity: 0,
  })
  let cartelTimer = null
  const avisar = (texto, tipo = 'ok', fijo = false) => {
    cartel.textContent = texto
    cartel.style.background = tipo === 'error' ? '#ff4040' : tipo === 'carga' ? '#ffd23f' : '#7CFC00'
    cartel.style.opacity = 1
    clearTimeout(cartelTimer)
    if (!fijo) cartelTimer = setTimeout(() => { cartel.style.opacity = 0 }, 3000)
  }

  // ---- limpieza general: deja Hydra y el MIDI como recién abiertos ----
  M.limpiar = () => {
    // MIDI: botones, faders, filas, LEDs y funciones de la canción anterior
    try {
      GP.midi.reset()
      GP.midi.versiones({})
      GP.midi.alMensaje(null)      // también apaga el Shift directo de Perdido
      GP.midi.alDisparo(null)
      GP.midi.alVersion(null)
      GP.midi.fundido(true)
    } catch (err) { console.warn('[GP master] limpiar MIDI:', err) }

    // lo que cada canción dejó en pantalla por su cuenta (Perdido: el cuadro de la cadena y sus luces)
    try { if (GP.perdido && GP.perdido.apagar) GP.perdido.apagar() } catch (err) { console.warn('[GP master] apagar Perdido:', err) }

    // videos e imágenes de s0..s3 (Perdido, Buscando Placer): pausar antes de soltar
    for (const s of [s0, s1, s2, s3]) {
      try { if (s.src && typeof s.src.pause === 'function') s.src.pause() } catch (e) {}
    }

    // pantalla, update y fuentes
    hush()
    update = () => {}
    speed = 1
    bpm = 30
    render(o0)

    // mic: valores de Hydra por defecto y barras ocultas
    if (typeof a !== 'undefined' && a) {
      try { a.setBins(4); a.setCutoff(2); a.setSmooth(0.4); a.setScale(10); a.hide() } catch (e) {}
    }
  }

  // ---- preparar el texto de la canción (sin tocar el archivo) ----
  const COMUNES = /^\s*await\s+cargarGP\(\s*['"]LIVE\/arq\/GP_(midi|estados|tools)\.js['"]\s*\).*$/gm
  const preparar = (texto, ruta) => texto
    .replace(/const\s+GP_SHA\s*=\s*['"][^'"]*['"]/, `const GP_SHA = '${GP_SHA}'`)
    .replace(COMUNES, (linea, cual) => `// [master] GP_${cual} ya está cargado`)
    + `\n//# sourceURL=${ruta}`

  // ---- ir a una canción ----
  M.ir = async (n) => {
    n = Number(n)
    if (M.cargando) { console.info('[GP master] esperá: todavía está cargando'); return M }
    if (!(n >= 0 && n <= CANCIONES.length)) { console.warn(`[GP master] no hay canción ${n}`); return M }

    M.cargando = true
    M.limpiar()
    M.actual = n

    if (n === 0) {
      avisar('■ negro')
      M.cargando = false
      return M
    }

    const nombre = CANCIONES[n - 1]
    const ruta = `LIVE/sketches/${nombre}.js`
    const desde = M._anterior || '—'
    const dato = M.informeDatos[nombre] || (M.informeDatos[nombre] = { cargas: 0, errores: 0, ultimaSeg: null, maxSeg: 0, ultimoError: '' })
    avisar(`… ${n} · ${nombre}`, 'carga', true)
    console.info(`[GP master] → ${n} · ${nombre} (venía de ${desde})`)

    const t0 = performance.now()
    try {
      const codigo = preparar(await textoGP(ruta), ruta)
      await new AsyncFunction(codigo)()
      const seg = (performance.now() - t0) / 1000
      dato.cargas++; dato.ultimaSeg = +seg.toFixed(2); dato.maxSeg = Math.max(dato.maxSeg, dato.ultimaSeg)
      avisar(`▶ ${n} · ${nombre} · ${seg.toFixed(1)} s`)
      console.info(`[GP master] ✓ ${nombre} en ${seg.toFixed(2)} s`)
    } catch (err) {
      dato.errores++; dato.ultimoError = String(err && err.message || err)
      avisar(`✗ ${n} · ${nombre}: ${dato.ultimoError}`, 'error', true)
      console.error(`[GP master] ✗ ${nombre}:`, err)
      M.limpiar()
    }
    M._anterior = nombre
    M.cargando = false
    return M
  }

  M.siguiente = () => M.ir(Math.min(M.actual + 1, CANCIONES.length))
  M.anterior = () => M.ir(Math.max(M.actual - 1, 1))
  M.recargar = () => M.ir(M.actual)
  M.negro = () => M.ir(0)
  M.informe = () => {
    console.table(Object.fromEntries(CANCIONES.map(c => [c, M.informeDatos[c] || { cargas: 0 }])))
    return M
  }

  // ---- teclado: Ctrl+Alt+… (en captura, para que el editor no lo escriba) ----
  if (window._gpMasterTeclas) window.removeEventListener('keydown', window._gpMasterTeclas, true)
  window._gpMasterTeclas = (e) => {
    if (!(e.ctrlKey && e.altKey)) return
    let accion = null
    const d = /^(Digit|Numpad)(\d)$/.exec(e.code)
    if (d && d[2] === '9') accion = M.recargar
    else if (d) accion = () => M.ir(Number(d[2]))
    else if (e.code === 'ArrowRight') accion = M.siguiente
    else if (e.code === 'ArrowLeft') accion = M.anterior
    if (!accion) return
    e.preventDefault(); e.stopPropagation()
    accion()
  }
  window.addEventListener('keydown', window._gpMasterTeclas, true)

  console.info(`[GP master] ${VERSION} listo · Ctrl+Alt+1..${CANCIONES.length} · Ctrl+Alt+→ ← · Ctrl+Alt+0 negro · Ctrl+Alt+9 recargar · GP.master.informe()`)
})()

// primera vez: arranca en la canción inicial · al reevaluar el master: se queda donde estaba
if (!GP.master._arrancado) {
  GP.master._arrancado = true
  await GP.master.ir(CANCION_INICIAL)
}
