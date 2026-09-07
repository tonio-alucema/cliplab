# ClipLab

A standalone 3D character studio for product companions and marketing assets. Three simple bodies—capsule, rounded end cap, and sphere—share graphic faces, smooth two-color fills, and crisp toon shading.

## Run

```sh
pnpm install
pnpm dev
```

Open http://localhost:5190. `pnpm build` checks TypeScript, bundles the portable character runtime, and builds the studio. `pnpm test` runs the tests. Vue 3, TypeScript, Vite, and Three.js.

## Author a character

1. Choose Milo, Pip, or Lumi. In **Character**, choose a body, colors, shading, white eye dots, or face elevation.
2. Select an **Expression** to preview it; double-click or choose **Edit selected** to adjust its face and body. Each expression has timed beats; select, reorder, duplicate, or add beats in the strip below the stage.
3. In **Animations**, combine expressions, adjust their duration, and turn looping on or off. The ten starters are Idle, Listening, Thinking, Working, Success, Confused, Sleepy, Playful, Sad, and Tearful. Older saved projects can use **Add new presets** to add missing expressions without replacing their edits.
4. Drag the character or orientation globe to rotate; hold Shift while dragging to roll. The globe also supports arrow keys and Home to reset. Motion controls adjust speed, body movement, blinking, and cursor following.

Click a size preset to resize the main preview to that exact CSS size; **Fit** restores the large preview. Below 16 px the face disappears; 16–24 px shows eyes only; above 24 px shows the full face. Display density does not change these thresholds. Marketing export dimensions are configured independently.

**Front** keeps the camera and animated body turns at a true front angle. **Position** stops floating and secondary breathing while preserving authored stretch, facial expressions, and supporting effects. Both settings are saved with the character and included in app and media exports. Dragging the orientation control releases Front.

In **Character**, **Candle light** fixes slightly offset, concentric toon bands to the camera. Turning it off restores directional shading. In the expression editor, face presets combine circular eyes, half-circle arcs, and broad outlined mouths. **Cheek cutouts** remove a circular section from the lower eyes; white eye dots enlarge the black eyes by 20%. Tears and supporting props ease through deterministic loops, including when Position is locked.

Changes autosave to this browser. Undo and redo keep recent edits. Export a **Project** file to back up all characters and sequences or move them to another browser; import validates the file before replacing the current project. Local browser storage is not cloud synchronization.

## Export

- **App:** select animations and download a character JSON definition or a complete JavaScript/React package. The ZIP includes the same renderer used in the studio, a working example, type declarations, and integration instructions. JSON alone is configuration and needs the supplied runtime.
- **Image:** PNG of the current pose, with transparent or solid background, framing, presets, and dimensions up to 2048 px.
- **Animation:** MP4 with an opaque background, WebM with optional transparency, or transparent GIF. Video supports up to 2048 px and 60 seconds. GIF uses 20 fps and at most 512 px. MP4 requires even dimensions. Browser video encoding support varies; encoding errors are shown in the studio.
- **Project:** the full editable studio, including characters, expressions, and sequences.

App packages expose `createCharacter(container, definition, options)`, returning playback, state-selection, gaze, size, and cleanup methods. The included React component accepts `animation`, `size`, and `followCursor`. Keep the host square; call `destroy()` when removing a plain JavaScript character. The runtime respects reduced motion and pauses animation work when offscreen.

## Implementation

The new studio lives in `src/studio/`. `model.ts` defines the portable data and deterministic animation sampling; `renderer.ts` draws the actual geometry and curved face shell; `runtime.ts` provides the independent player; `export.ts` creates packages and rendered assets. `tools/build-studio-runtime.mjs` builds the standalone player before development or production builds.

`tools/studio-check.html` is a development-only browser verification page for video decoding, transparent exports, ZIP contents, and size thresholds. It is not part of the production build.

The previous SVG studio and tests remain in the repository for reference; its former documentation is in [docs/legacy-readme.md](docs/legacy-readme.md). The active studio uses the new analytic 3D bodies and expression set.

## Credits

ClipLab started as a fork of [bloub](https://github.com/jeremy-prt/bloub) by Jérémy Perret. Its GIF and MP4 export helpers are reused. The studio workflow is inspired by the [Bible Strong Avatar Lab](https://avatars.bible-strong.app/); no source from that application is copied. Three.js is MIT licensed. See [LICENSE](LICENSE) for this repository's license.
