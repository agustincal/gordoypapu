# Manual · GP_estados (Fase 3 · LIVE)

Estados genéricos para todas las canciones. Vive en `LIVE/arq/GP_estados.js`.
Actualizado: 2026-10-16 · GP_estados v1.0

---

## 1. Qué es

Un **estado** es una foto de la consola más los ajustes propios de la canción:

- faders, toggles, versiones y mutes, como si los hubieras puesto a mano;
- valores del visual que no tienen control físico (color, tiempos, probabilidades…).

Cada nota que llega por el **canal 16 del Korg** (el código convenido con los músicos) pasa al **estado siguiente**. El sketch nunca menciona el canal 16: lo maneja el módulo.

En vivo podés tocar cualquier control: **gana tu mano hasta el próximo estado**.

---

## 2. Cómo se usa en un sketch

```js
await cargarGP('LIVE/arq/GP_midi.js')
await cargarGP('LIVE/arq/GP_tools.js')       // sólo ensayo
await cargarGP('LIVE/arq/GP_estados.js')
await cargarGP('LIVE/arq/GP_03_Vociferan__visual.js')

await GP.midi.start()
V.init({ ... })                 // 1. la BASE de la canción
GP.midi.buttons([...])          // 2. toggles
GP.midi.filas({ ... })          // 3. filas de disparo
GP.estados.init({               // 4. estados, siempre después de lo anterior
  cancion: '03_Vociferan',
  destino: V.C,                 // la configuración del visual: acá se escriben los valores
  controles: CONTROLES,
  estados: ESTADOS,
  alEntrar: (estado, numero) => { },   // opcional: algo propio al entrar a un estado
})
```

---

## 3. Controles

Nombre (el mismo que en `V.init`) → control físico.

```js
const CONTROLES = {
  tamano:    'F1',    // fader
  direccion: 'F2',
  strobe:    'N11',   // toggle
  forma:     'V3',    // versión del fader F3
  melodia:   'M8',    // mute de la fila 8
}
```

| Control | Qué es | Valores en los estados |
|---|---|---|
| `F1`..`F8` | fader | 0 a 1 |
| `N11`..`N88` | toggle (filas 1–4) | `true` / `false` |
| `V1`..`V8` | versión del efecto del fader (botones 64–71) | 0, 1 o 2 |
| `M5`..`M8` | mute de una fila de disparo | `true` = muteada |

- **Faders (takeover):** al entrar a un estado, el fader manda el valor del estado aunque esté físicamente en otro lado. Apenas lo movés, toma el control (con una transición corta). En el próximo estado vuelve a mandar el estado.
- **Toggles, versiones y mutes:** se aplican al entrar, con su LED. Los podés cambiar a mano hasta el próximo estado.
- Si un control no está en `V.init`, su base es 0 / `false`.

---

## 4. Estados

```js
const ESTADOS = [
  /* 1 */ { nombre: 'intro',            tamano: 0.35, strobe: false, release: 2 },
  /* 2 */ { nombre: 'entra la voz',     tamano: 0.5 },
  /* 3 */ { nombre: 'estribillo',       tamano: 0.7, hue: 0 },
  /* 4 */ { nombre: 'puente',           direccion: 0.5, hue: 200 },
  /* 5 */ { nombre: 'estribillo final', como: 3, tamano: 0.85, fundido: 1 },
]
```

- **Lo que un estado no anota sale de la base** (lo que pusiste en `V.init`). No hereda del estado anterior.
- **`como: N`** arranca del estado N y le cambia lo que anota. Para repetir un estado con cambios.
- **`fundido`**: segundos que tarda en llegar a ese estado (si no se anota: 0.3). Los números se funden; `true`/`false` y textos cambian al instante.
- **`nombre`**: opcional. Aparece en el cartel de ensayo y en la consola.
- **Antes de la primera nota del canal 16** está el estado 0, `inicio` (= la base).
- **Después del último estado**, las notas se ignoran.
- Si escribís un nombre que no existe en `V.init` (ej: `tamanio`), la consola avisa: probablemente es un error de tipeo.

---

## 5. Ajustes a mano

- `V.C.release = 2` + Ctrl+Enter: dura hasta el próximo estado que anote `release`. Si ningún estado anota `release`, queda.
- Los golpes de paleta de Vociferan cambian `hue` de la misma forma: hasta el próximo estado que anote `hue`.

---

## 6. Ensayo

- **Botones redondos 86 / 87** = estado anterior / siguiente. LED prendido = hay a dónde ir. Sirven también de emergencia en el show.
- **Cartel arriba a la derecha** (`3/5 · estribillo`), sólo si está cargado GP_tools. En el show no aparece.
- **Reevaluar el sketch no vuelve al principio**: re-aplica el estado actual con los números nuevos. Así se cura un estado sin perder el lugar.
- **`GP.estados.reiniciar()`** vuelve al inicio. Hacelo antes de dar ▶ a un ensayo grabado.
- Consola:
  - `GP.estados.siguiente()` · `.anterior()` · `.ir(4)`
  - `GP.estados.numero` · `.nombre` · `.actual` (el estado resuelto)
  - `GP.estados.tabla()` → todos los estados ya resueltos, en una tabla (para ver el arco de la canción)
  - `GP.estados.valor('tamano')` → lo que se está usando ahora

---

## 7. Configuración general

En `GP.estados.config` (igual para todas las canciones; se cambia en `GP_estados.js` si cambia el hardware):

| Campo | Valor | Qué es |
|---|---|---|
| `fuente` | `/korg\|padkontrol/i` | aparato que manda los cambios (incluye `korg_Ensayo`) |
| `canal` | 16 | canal de estados |
| `antirrebote` | 150 ms | dos notas más juntas cuentan como una |
| `botonAnterior` / `botonSiguiente` | 86 / 87 | `null` = sin botón |
| `fundido` | 0.3 s | fundido por defecto |
| `umbralToque` | 3 | cuánto hay que mover un fader (0..127) para tomar el control |
| `mezclaToque` | 0.25 s | transición del valor del estado al del fader |
| `suavizado` | 0.1 s | suavizado del fader físico |
