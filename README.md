# Jungle Launch v0.4 — Three.js Migration

This branch migrates Jungle Launch from the flat Canvas renderer to a hybrid architecture:

- **Three.js WebGL 3D presentation**
- **Existing deterministic 2D gameplay physics preserved**
- **Rigged GLB player support** at `assets/models/professional.glb`
- Procedural posing for the supplied Mixamo-style skeleton
- Perspective camera, dynamic FOV and look-ahead
- PBR materials, soft shadows, fog, bloom and ACES tone mapping
- Chunked 3D terrain and dense instanced vegetation
- 3D encounter stand-ins for gorilla, toucan, jaguar, sloth, turtle, mushroom, vine, rock, puddle and idol
- HTML/CSS HUD layered over the 3D renderer
- Existing fixed 120 Hz simulation, swept encounter collision and deterministic procedural world generation retained

## Supplied character inspection

The uploaded **The Professional.glb** was inspected before integration:

- glTF 2.0 / GLB
- 1 skin / 26 joints
- Mixamo-style bone names
- 8 materials
- 2 embedded 1024×1024 textures
- no authored animation clips
- approximate bounds: 0.57 × 0.62 × 0.53 units

Because the model is rigged but contains no animation clips, the v0.4 renderer procedurally drives the arm/leg/spine bones during aim, flight and dive. Authored animation clips can be added later without replacing the character.

> Binary asset note: the ChatGPT GitHub connector used for this migration can write source text but does not expose a binary-file upload action. The renderer therefore falls back to a generated 3D monkey if `assets/models/professional.glb` is not present on the branch. The downloadable v0.4 package produced in this chat already includes the uploaded GLB.

## Controls

- Space / W / Up / click: action / boost / special reaction
- Shift / S / Down / right click: dive
- P: pause
- R: restart same seed
- F2: debug
