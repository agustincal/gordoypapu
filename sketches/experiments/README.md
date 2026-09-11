# Hydra Experiments

Zona de experimentación para sketches Hydra.

Cada experimento se guarda como un archivo independiente, con nombre y versión explícitos. La idea es conservar pruebas funcionales y variantes sin mezclarlas con las bases de arquitectura.

## Convención

```text
NNN-nombre-vX.Y.js
```

- `NNN` → número correlativo del experimento.
- `nombre` → descripción breve.
- `vX.Y` → versión del sketch.

Ejemplo:

```text
001-midi-stems-test-v0.1.js
002-button-grid-v0.1.js
003-audio-reactive-v0.2.js
```

## Comentarios

Cada archivo debe comenzar con un encabezado breve que indique:

- nombre del sketch
- autor
- versión
- objetivo de la prueba
- observaciones relevantes

Las versiones se conservan: si una prueba evoluciona, crear una nueva versión en lugar de sobrescribir la anterior cuando sea útil conservar el comportamiento previo.

## Base GP

Los experimentos pueden utilizar la plantilla de sketch y una versión fijada de `GP-base`, para que una prueba siga siendo reproducible aunque la arquitectura avance.
