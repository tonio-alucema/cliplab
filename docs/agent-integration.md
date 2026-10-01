# Integrate ClipLab into Paperclip

## Use this release

Use **ClipLab runtime 0.7.4** or newer with a fresh `.character.json` exported from the studio. The runtime uses the same renderer and animation sampler as ClipLab. It includes the mouth-stroke playback fix, interpolated expressions, brow controls, particle size/count/outward movement, gradient turns per beat, face-anchored toon lighting, cursor tracking, and current size adaptations.

- Repository: https://github.com/tonio-alucema/cliplab
- Latest runtime package: https://github.com/tonio-alucema/cliplab/releases/latest
- Studio: https://cliplab-character-studio.paperclip-la-1425.chatgpt.site/

The runtime ZIP contains `cliplab.js`, `cliplab.d.ts`, its supporting model types, licenses, and `runtime-manifest.json` with the version, source commit, and SHA-256 checksums. Three.js is already bundled; the runtime does not require Vue or the studio UI. Keep all declaration files together. Vendor this folder into the consuming app and commit it with the character JSON. Pin a release rather than loading mutable remote code at runtime.

To build from source, check out the intended release/commit, install dependencies, and run `pnpm runtime:package`. Output is `dist-runtime/cliplab-runtime-<version>.zip`. A build from modified tracked files is marked `workingTreeDirty: true` in its manifest. Release packages are built from the committed source.

## Get the actual custom animation

Custom studio expressions are saved in the user's browser, not in this repository. Ask for the exported `.character.json`; do not recreate the user's sleepy-to-wake expression from a screenshot or substitute the built-in Sleepy animation.

In the studio:

1. Add the custom expression to an animation in **Animations**.
2. Set the sequence duration as desired. An animation step scales the referenced expression to its step duration.
3. Turn off **Loop** for a one-shot sleepy-to-wake transition.
4. In **Export → App**, select this animation and download JSON. Only expressions referenced by the selected animations (and linked face-motion expressions) are included.

The `.character.json` contains `version: 1`, one `character`, `expressions`, and `animations`. Use the actual `animations[].id` from this file, not its display name. Preserve all numeric pose fields, gradient actions/turns, linked face motion, and particle fields. Do not replace missing fields manually; the runtime's parser supplies defaults for older definitions. Schema version 1 is separate from runtime package version 0.7.4.

A `.cliplab.json` is the full editable project backup, including saved clips and favorites. Use the App export for integration. Favorites and timeline copy/paste are authoring tools; the exported beat settings contain their resulting animation data.

## Minimal integration

```js
import { createCharacter, RUNTIME_VERSION } from './vendor/cliplab/cliplab.js';

const response = await fetch('/assets/custom.character.json');
if (!response.ok) throw new Error('Character definition could not be loaded');
const definition = await response.json();
const animationId = definition.animations[0].id; // Choose the intended ID explicitly if there are several.
const player = createCharacter(document.querySelector('#clip'), definition, {
  animation: animationId,
  size: 128,
  autoplay: false,
  background: null,
});
console.info('ClipLab runtime', RUNTIME_VERSION);

// Call this when Paperclip's actual application event occurs.
function wake() {
  player.setAnimation(animationId); // Selects and restarts the sequence.
  player.play();
}

// On component unmount / removal:
function cleanup() { player.destroy(); }
```

Use a square container with explicit CSS dimensions. Mount in the browser after the element exists; do not initialize the WebGL player during server-side rendering. For React, create the player in an effect and return `player.destroy()` from its cleanup, or start from the React package in **Export → App**.

`autoplay: false` shows the sequence's initial pose until the app calls `play()`. With `loop: false`, playback holds the final pose on completion. Calling `setAnimation(id)` followed by `play()` restarts it. `setExpression(id)` previews an expression as a loop; use an animation with `loop: false` for one-shot app behavior. The player does not expose an on-complete callback in this release; do not invent that API or couple application state to a wall-clock timeout.

Supported methods: `play`, `pause`, `setAnimation`, `setExpression`, `seek` (seconds), `setGaze`, `setSize`, `setDefinition`, and `destroy`. See generated `cliplab.d.ts` for the exact API. `setDefinition` resets the current selection to the first animation; select the desired animation again afterward. Preserve authored eye/body following by omitting `followCursor` and `followRotation` overrides unless the host specifically needs to change them.

## Per-beat 3D rotation

`Beat.rotationTravel` is optional and stores signed degree amounts: `{ "x": 0, "y": 720, "z": 0 }` makes two Y-axis turns over that beat's full duration. Values support −1440° through +1440° per axis. Rotation uses gentle sine easing and retains full turns rather than taking the shortest path. Completed amounts carry into later beats; whole turns produce a seamless loop. The older pose rotation fields remain resting angles and keep their original short transitions.

Keep `character.trueFront` false to show rotation. Authored turns add to body-follow orientation when enabled. Compact sizes at 32 px and below stay front-locked. Beat rotation is preserved in JSON, favorites, copy/paste, and media exports. Runtime 0.3.0 or newer is required; 0.2.x does not play these new fields.

## Body shapes and modifications

Runtime 0.4.0 adds `character.shape: "chunky-pill"`, a capsule with a width-to-height ratio of 1:1.5. Existing `capsule` (1:2), `cap` (1:1), and `sphere` shapes remain supported.

For `shape: "cap"`, optional `character.bodyModification` selects exactly one of `none`, `upside-down`, `rotate-left`, `rotate-right`, `ghost`, or `skeleton`. Capsule supports `none` or `horizontal`; Chunky pill also supports `skeleton`. Other shape/modification combinations remain inactive. The setting defaults to `none` for older JSON and is retained when switching shapes. Modifications leave the authored face, expressions, colors, gradient, and animation settings intact:

- `upside-down` flips only the body silhouette; the facial expression stays upright.
- `rotate-left` and `rotate-right` turn the End cap body 90° left or right, keeping the face upright.
- `horizontal` lays either pill shape on its side, keeping the face upright and fitting its width within the output.
- `ghost` adds a gently rippling scalloped hem. The wave uses the playback timeline, pauses with playback, and stays still with reduced motion. It is independent of the body-movement amount and position lock.
- `skeleton` reveals a 3D skull and four ribs through the translucent gradient shell. The bones follow all body rotations and pose transforms. It does not add arms or a ghost hem. For End cap, set `character.roundedSkull: true` for a perfect spherical cranium, sized and lowered to sit inside the toon band, with flat toon socket/nose patches on its 3D surface and no jaw. The original End cap skull remains the default. Chunky pill always uses the updated spherical style, with a larger skull positioned above its four ribs; its `roundedSkull` value is ignored. Its default face anchor is raised to align with the sockets while retaining authored expression settings and `pose.faceY` offsets. The shape and surface patches turn together in 3D. Runtime 0.6.1 reduces both spherical skulls by 10%, lowers them for clearance inside the inner toon silhouette, aligns resting sockets with the eyes, and halves rib length while retaining bone thickness and bringing the rib centers 20% closer to the midline. Runtime 0.6.2 further halves the visible horizontal gap between the left and right rib pairs without changing their length, thickness, or vertical positions.

Sideways body modifications require runtime 0.5.0 or newer. The revised spherical skull and Chunky pill skeleton require runtime 0.6.0 or newer. Preserve `bodyModification` and `roundedSkull` when copying definitions.

PNG/video exports use the same scene. SVG snapshots retain the wavy silhouette or a compact additional Inner skeleton group. Update the runtime as well as the character JSON when using these features; older runtimes do not support the new shape/modifications.

## Size and motion behavior

Size is in CSS pixels, independently of display pixel density.

| Size | Behavior |
| --- | --- |
| 16 px | Enlarged compact eyes and smile; no iris; front locked; flat color/gradient. |
| 20–24 px | Compact off-center eyes and smile; no iris; front locked; flat color/gradient. |
| 32 px | Compact off-center eyes and smile; no iris; front locked; authored toon shading remains available. |
| 40–48 px | Body motion/turning restored; simplified black eyes, no iris; authored toon shading. |
| Above 48 px | Full authored expression, props, iris and motion settings. |

At 12 px and below, the renderer shows the body only; 12 px is no longer a studio preset. At sizes of 24 px and below, end-cap bottom fillets are removed; the ghost keeps its scalloped hem. The 16px appearance replaces the old 16-A option.

Reduced motion is respected by default and offscreen animation work pauses. Keep those behaviors enabled. Eye and body following are independent; front lock takes precedence over body turning. Toon lighting follows face orientation. JSON alone cannot render these behaviors without the matching player.

## Question and sparkle particles

Runtime 0.7.0 uses the supplied rounded SVG artwork for `pose.prop: "question"` and `"sparkle"`. Questions cycle continuously in an evenly staggered trail; stars use a tightly staggered burst with a fast outward launch and a slower fade. Both grow outward with repeatable, slight rotation variation and stay in front of the character near its upper-right edge. Their full motion is included in the runtime and media exports; SVG snapshots retain editable vector paths.

Runtime 0.7.1 renders these two effects with reusable vector meshes instead of enlarging a small bitmap, keeping particle edges crisp at larger previews and export sizes. Both artworks are 20% smaller, and stars have separated trajectories throughout the burst. SVG snapshots use the same artwork scale and motion.

Runtime 0.7.2 reduces both artworks a further 15%. Each star now has its own staggered motion clock, grows outward with a quick burst and slow settle, rotates 45 degrees during its lifetime, and fades independently. Question timing stays unchanged.

Runtime 0.7.3 tightens both particle clusters while retaining a visible gap. Question travel opens gradually with growth, and neighboring marks receive varied, reproducible tilts. Stars keep their independent burst timing and 45-degree lifetime spin.

Runtime 0.7.4 keeps body framing identical with or without particles. Question and star clouds move inward when needed to stay inside the existing viewport; only oversized particle clouds scale to fit. This placement is shared by live rendering and SVG exports, without changing the body or camera zoom.

`propCount: 0` (the automatic setting) now means three particles for both effects. Explicit counts and the existing `propSize` and `propOutward` controls remain supported. Existing definitions adopt the new behavior without a JSON migration. Reduced motion shows a static three-tier arrangement (or the authored count).

## Upgrade checklist for an integrating agent

1. Replace the old runtime **and** declaration files with the complete release package. Do not only replace the JSON if the host's runtime predates the recent renderer fixes.
2. Add the user's new exported JSON to the consuming app. Keep a backup of the previous file.
3. Check `RUNTIME_VERSION` and the manifest's source commit/checksums. The release manifest hashes every payload file except itself.
4. Connect the actual Paperclip event to the intended animation ID; do not infer the trigger from the animation name.
5. Compare the thick-mouth/tongue appearance during playback to the studio, check particles and gradient timing, and confirm the one-shot sequence holds its final pose.
6. Check the host's intended CSS size, reduced-motion behavior, mounting/unmounting, and absence of duplicate canvases after navigation.

No change to the ClipLab source is required for each new custom expression. Commit the updated JSON and integration code in Paperclip's repository.
