# Integrate ClipLab into Paperclip

## Use this release

Use **ClipLab runtime 0.2.0** or newer with a fresh `.character.json` exported from the studio. The runtime uses the same renderer and animation sampler as ClipLab. It includes the mouth-stroke playback fix, interpolated expressions, brow controls, particle size/count/outward movement, gradient turns per beat, face-anchored toon lighting, cursor tracking, and current size adaptations.

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

The `.character.json` contains `version: 1`, one `character`, `expressions`, and `animations`. Use the actual `animations[].id` from this file, not its display name. Preserve all numeric pose fields, gradient actions/turns, linked face motion, and particle fields. Do not replace missing fields manually; the runtime's parser supplies defaults for older definitions. Schema version 1 is separate from runtime package version 0.2.0.

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

## Size and motion behavior

Size is in CSS pixels, independently of display pixel density.

| Size | Behavior |
| --- | --- |
| 16 px | Enlarged compact eyes and smile; no iris; front locked; flat color/gradient. |
| 20–24 px | Compact off-center eyes and smile; no iris; front locked; flat color/gradient. |
| 32 px | Compact off-center eyes and smile; no iris; front locked; authored toon shading remains available. |
| 40–48 px | Body motion/turning restored; simplified black eyes, no iris; authored toon shading. |
| Above 48 px | Full authored expression, props, iris and motion settings. |

At 12 px and below, the renderer shows the body only; 12 px is no longer a studio preset. At sizes of 24 px and below, end-cap bottom fillets are removed. The 16px appearance replaces the old 16-A option.

Reduced motion is respected by default and offscreen animation work pauses. Keep those behaviors enabled. Eye and body following are independent; front lock takes precedence over body turning. Toon lighting follows face orientation. JSON alone cannot render these behaviors without the matching player.

## Upgrade checklist for an integrating agent

1. Replace the old runtime **and** declaration files with the complete release package. Do not only replace the JSON if the host's runtime predates the recent renderer fixes.
2. Add the user's new exported JSON to the consuming app. Keep a backup of the previous file.
3. Check `RUNTIME_VERSION` and the manifest's source commit/checksums. The release manifest hashes every payload file except itself.
4. Connect the actual Paperclip event to the intended animation ID; do not infer the trigger from the animation name.
5. Compare the thick-mouth/tongue appearance during playback to the studio, check particles and gradient timing, and confirm the one-shot sequence holds its final pose.
6. Check the host's intended CSS size, reduced-motion behavior, mounting/unmounting, and absence of duplicate canvases after navigation.

No change to the ClipLab source is required for each new custom expression. Commit the updated JSON and integration code in Paperclip's repository.
