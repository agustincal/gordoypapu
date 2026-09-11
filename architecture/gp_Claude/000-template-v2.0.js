// G&P — NOMBRE DEL EXPERIMENTO — v2.0
// by Agu.Chino

//
// SETUP — no toques nada de esto salvo el nombre de la canción
await loadScript('https://cdn.jsdelivr.net/gh/agustincal/gordoypapu@main/architecture/gp2/gp-core-v1.0.js')
await GP.init({ song: 'NOMBRE_DE_CARPETA_EN_STEMS' })   // ← cambiá esto por 'buscandoplacer', 'vociferan', etc.

GP.midi.faders(['F1','F2','F3','F4','F5','F6','F7','F8'])
// GP.midi.buttons(['N11'])
//
// Al ejecutar este bloque: se conecta la AkaiMini (si está enchufada)
// y arrancan a sonar los 4 stems de la canción automáticamente.
//
// F1–F8 / FMASTER → 0–1 | N11–N88 → 0/1
// bass / drums / synth / vocals → .low() .mid() .high()

// AUDIO — MUTE (true) / UNMUTE (false)========
// Object.values(GP.audio.stems).forEach(s => s.mute(true))
//



// ======================================================
// EXPERIMENTO
// ======================================================
