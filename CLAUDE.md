# Cliplab: notes for Claude

## Where this project is

A fork of [bloub](https://github.com/jeremy-prt/bloub) (MIT, Jérémy Perret) being
turned into a character studio with a lightweight embeddable runtime.

**Read the plan first:** `~/.claude/plans/i-want-to-remix-streamed-valley.md`. It
carries the licensing split, the phase order, and bloub's invariants — the rules
below are a summary, the plan has the reasoning.

Done: Phase 0 (rename) and Phase 1 (size spike + shape library). Next: Phase 2 —
layered eyes.

**Phase 1 reversed the plan's premise, so read [docs/size.md](docs/size.md) before
designing around either ship target.** The JS runtime is the light one (10.9 kB
gzip, whole engine); the baked SVG is light only for a resting loop (5.4 kB) and
reaches 792 kB for the default cycle. The plan has the bake as primary and the
runtime as the risk; the measurements say the opposite.

⚠️ This repo still ships bloub's measured `src/bot/profiles.ts` and the 14 states
derived from it. Those reproduce the x.ai bot design; MIT covers Jérémy's code,
not that design. The roster phase replaces them — required before commercial use.

## Commands

```bash
pnpm dev       # 5190 (set in vite.config.ts, mirrored in .claude/launch.json)
pnpm test      # vitest
pnpm build     # vue-tsc --noEmit && vite build
```

Vue 3.5 + Vite 8 + TS strict + Tailwind 4 (`@tailwindcss/vite` plugin, no
`tailwind.config.js`), pnpm.

Style: 2 spaces, single quotes, **no semicolons**, comments in French. No ESLint
and no Prettier: `vue-tsc` is the only gate, so run `pnpm build` before
concluding.

## The most important rule

**The bot's numeric constants are measurements taken off the reference video, not
settings.** Gaze angles, eye sizes, radii, timings, colours: all of it comes from
frame-by-frame analysis. Don't round them, don't simplify them, don't replace them
with values that look tidier: it breaks the resemblance, which is the only
success criterion here.

The verified traps that must not be "corrected" are listed in
[docs/measurements.md](docs/measurements.md). Read it before touching a number in
`src/bot/`.

Two deliberate exceptions, and they are the only ones:

- **`--ink` (`styles.css`) is the interface colour, chosen, not measured**, a night
  blue. The video's black is the bot's, in `skins.ts` (`encre`, `#0a0a0c`).
  Retouching one doesn't touch the other.
- **The whole eye anatomy in `face.ts` is ours, chosen**: `EYE_W`/`EYE_H` (a circle,
  where the video measured a 1:2.2 slot), `EYE_SPLIT` (19°, where it measured 15.46)
  and `REST_GAZE` (14/14/-5, where it measured 28.49/28.62/-13). That is Phase 2 of
  the plan doing what it is for. The **sphere model itself and the blink timings are
  still measured** and still hold — they are engineering, not character.

  The yaw is lower because the iris made it so: on a slot with no inside, the HEAD
  has to carry the gaze, which is what made the reference's very turned pose
  necessary. **It does not go to zero, and that is not a half-measure**: the sphere
  only reads at three-quarters, since the yaw is what compresses the outer eye
  (0.81 against 0.98 wide) and that compression is the whole volume cue. Head-on,
  the two eyes become identical and the best of what is inherited stops showing. A
  test locks the compression into a band rather than to a value.

**A measurement fixture must not read a shipped constant.** `face.test.ts` had the
rest eye's dimensions as `w: EYE_W, h: EYE_H` where its two sibling fixtures used
literals. The two coincided only while our eye was the reference's, and the test
broke the moment they parted — reporting a failure of the sphere model, which was
fine, instead of a divergence we had chosen. A fixture records what the video showed.

## Invariants worth knowing before editing

Details and the reasoning behind each are in [docs/](docs/):

- **`src/bot/` has no framework and no clock.** `engine.sample(t)` is a pure
  function of time. That's what makes `frozenAt`, the state board and the
  DOM-less tests work. No real-time state, no `Date.now()`, no Vue import. And
  **`sample()` must not mutate**: purging a stale previous state during playback
  makes the engine non-replayable (there's a dedicated test). Shared Vue code goes
  in `src/ui/`.
- **The montage holds or cuts, it never scales time** (`cycles.ts`). Hence
  `MIN_BLOCK` (0.6 s) and `StateDef.minDuration`, which is read off the state's
  `pose()` constants. Fill it in for any new narrative state.
- **All silhouettes share the same angular sampling** (`PROFILE_SAMPLES`), which is
  what makes morphing a linear interpolation of radii. A new shape must go through
  a radial profile, or `profileFromPolygon`.
- **The eyes are holes in a `<mask>`**, not white shapes on top. That's what makes
  them clip against the silhouette on their own.
- **The render frame lives in `src/bot/repere.ts`**: `RAYON` (100) and `DEMI_VIEWBOX`
  (158) define what `sample()` returns, so they can't sit in a `<script setup>` where
  nothing can import them — `export.ts` used to redeclare one by hand. The Vue component
  is a client of the engine, not its definition.
- **Anything sitting "on" the body must follow its real radius**: `radiusAtAngle`
  (defined in `shape.ts`, applied by `engine.ts`) for the eyes and the notification
  pastille. A new element anchored to the outline needs the same treatment.
- **That pro-rata places the eye's centre, not the eye.** Since the margin in front of the
  edge is multiplied by the same factor, a narrow shape pushed the eye out through the mask.
  `src/bot/eyefit.ts` adds a **common offset to both eyes** — a translation, so an isometry —
  only on a customiser shape. **It is a table built at import, not a solver in the render
  loop**, and that distinction *is* the fix: seven per-frame versions all trembled, because
  everything they read (gaze drift, pointer, expression mid-morph, which edge is nearest)
  moves every frame. The engine reads the table on the **boundaries** of each morph and
  interpolates with that morph's own curve — never on the interpolated value, which has no
  identity and exists in no table. `docs/architecture.md` lists the six variants that were
  measured and rejected; don't re-try them. `skins.test.ts` locks the lot, and it sweeps
  **time as well as combinations** — one instant per combination is what let
  `capsule` + `effraye` through.
- **Eye layers are painted BEHIND the body, and nothing new clips them.** The eyes
  are holes in the mask, so a hole reveals whatever is behind — the iris/pupil/
  highlight stack goes there, and the body painted over it is what trims it. The one
  clip written by hand is to the **silhouette**: outside the body the mask paints
  nothing, so a layer past the edge would show bare against the page. `eyefit.ts`
  keeps the eyes inside; that clip keeps the guarantee if it ever stops.
- **A blink squashes the HOLE, never the layers** — hence two matrices per eye,
  `matrix` (with the squash) and `base` (without). The lid then *trims* the iris the
  way a real one does. Sharing the matrix gives a rubber iris; a test locks it.
- **A layer's radius is a fraction of the disc INSCRIBED in the sclera**,
  `min(w, h) / 2`, not of the half-width. Several expressions are wider than they
  are tall — `hilare` is 0.089 high by 0.447 wide — and a radius taken off the width
  left the sclera top and bottom by a factor of five. Locked by `eyes.test.ts`.
- **The eye style does not morph.** Its layers change in number and colour between
  styles, and there is nothing sensible to interpolate between "three discs" and
  "two". `setEyeStyle` takes no date, unlike `setShape` and `setExpression`.
- **Flat shading removes the SHADER, never the 3D.** That distinction is the whole
  contract of the Shading toggle: the pseudo-3D lives in the geometry — eyes on a
  sphere, their depth compression, the head orientation body and face share — and
  none of it moves when the gradient goes. A frame rendered at `relief: 0` is equal
  to one at `relief: 1` in every field but `shade`, and a test asserts exactly that.
- **The body's relief follows the SAME `HeadGaze` as the eyes** (`relief.ts`). That
  shared frame is the whole cue: a gradient pointed anywhere else reads as a stain,
  not as a form. It reads the composite gaze and not the nominal pose, so it moves
  with the drift and with the pointer — otherwise the body stays lit on one side
  while the face looks the other way.
- **The engine emits shading INTENSITIES, never colours.** It doesn't know the body
  colour — the user picks it — so `BodyShade` carries `lift`/`drop` and the render
  mixes them, exactly as `DotRender.depth` already did for the burst particles.
- **The relief is bakeable, and that is not luck.** A gradient is not a path, so it
  has no command signature to change between frames; its centres, radius and stops
  are numbers, and numbers interpolate. That is the Phase 1 test applied to a new
  cue, and the arcs are what failing it looks like.
- **States declare `ArcSpec`; only the engine rasterises.** Don't call `arcRender`
  from `states.ts`.
- **A state change landing inside a fade blends from the FROZEN composite pose**
  (`setState`), not from the full pose of the state being left — the engine has one slot of
  history, and using it naively jumped 26–43 px where a spaced change moves 10–14. It
  freezes **only** when a fade is in progress: doing it always would halt the outgoing
  state's own animation for the whole fade. Spaced playback is byte-identical, and a test
  locks both halves.
- **Transitions are exponential ease-outs and the body never overshoots.** The one
  spring is the notification pop (`NOTIF_POP = 1.14`). There is deliberately no
  spring engine. A new bouncing effect belongs in the state that needs it.
- **The catalogue is two shapes, and the circle is not one of them.** `dome` and
  `capsule` (standing, not lying) both have a clear top and bottom, which is what
  gives the body an orientation and therefore a face. The **circle still exists**,
  exported as `CERCLE` but out of the catalogue: it is the body of the measured
  states, the target of fades, and the ball of the arrival — which must be round
  for the length of its turn or the eyes hop (`docs/intro.md`). Passing `null` to
  the engine is exactly passing `CERCLE`, and a test holds that.
- **Two sources of shapes, not to be mixed.** `profiles.ts` is generated from the
  video and drives the animated states; `skins.ts` holds the customiser's shapes,
  built analytically. A user's shape only replaces the body on `baseBody` states
  (`idle`, `wink`, `wide`, `notify`, `swirl`); elsewhere the silhouette IS the
  animation.
- **Among catalogue states only `idle` carries `baseFace: true`** (`swirl` does too,
  but it isn't in the catalogue). The other face states have an expression measured
  off the video. That's the point.
- **A tilt is only visible on an elongated eye.** `expressions.test.ts` enforces it:
  width/height outside `[0.6, 1.7]` for a tilt of 20°+, outside `[0.8, 1.25]` below.
  Already went wrong once.
- **Labels don't live in `src/bot/`.** The catalogues carry ids and the display
  resolves `t('states.orbit')`. Their ids are **literal unions** so the compiler
  checks that every entry has a label in all three languages. Adding a shape
  without its label doesn't compile.
- **One state isn't measured: `swirl`**, the settings view's entry transition. It's
  deliberately outside `SEQUENCE` (a test locks that) and carries both `baseBody`
  and `baseFace`.
- **`mediabunny` is the only dependency besides Vue, and it must stay a DYNAMIC import.**
  It encodes the cycle's MP4 (`src/ui/video.ts`). Imported statically it adds **43 kB gzip**
  to the initial bundle, more than the 34 kB that got `vue-i18n` rejected in favour of the
  in-house layer. Behind `await import(...)` it costs 0.7 kB and only arrives when someone
  exports a video. Turning it into a top-level import would silently undo that.
- **Don't declare `role="menu"` without the keyboard contract.** Those roles *promise*
  arrow-key navigation and focus moved into the menu on open, and they stop exposing the
  children as ordinary buttons. Three popups declared them and implemented none of it, so
  the Tab order didn't match what was announced — they are plain button lists now, with
  `aria-haspopup="true"` and `aria-expanded`. `Settings.vue` shows the other route: a real
  `radiogroup` with a moving `tabindex`. Pick one, never the label alone.
- **64rem is the only breakpoint, and it separates two different layouts, not two sizes.**
  Above it the scene is the three-column grid and the page never scrolls (`#app { overflow:
  clip }`): things can float in the margins and be anchored to the window. Below it
  everything stacks and the page scrolls for real, which breaks exactly those three
  assumptions — so the rail becomes a top bar, the montage bar gets an opaque background
  (without one, content scrolls visibly through it), and the wordmark returns to the flow.
  Anything new that is `fixed`, or anchored to the bottom of `#app`, needs its own answer
  below 64rem. `--timeline` also changes there (236 → 200 px); the fine positioning that
  reads it lives inside the `>= 64rem` query and never sees the other value.
- **`prefers-reduced-motion` is followed at runtime, not read once**, and it draws a line:
  it cancels box transitions and the settings view's `swirl` entry, which are decoration;
  it does **not** cancel the breathing, gaze drift and blinking, which are what the bot IS.
- **A UI element that must appear once uses a `transition`, not an `animation`.** An
  animation replays on every mount: every view change, every reload. A transition
  doesn't run on an element's first computed style, so it stays quiet there. That's
  why `.panneau` and `.barre-export` are built that way, and why the latter is
  mounted-but-hidden during the arrival rather than absent.
- **`Look` aims in ABSOLUTE terms on both axes, and the engine does the mixing**:
  only it knows the pose at instant t. `mix` and `wander` are distinct, and drift is
  added *after* the mix. **`setLook` refuses a non-finite target**: the engine keeps
  the last one, so a single `NaN` would settle in forever.

## Where to read more

| | |
|---|---|
| [docs/architecture.md](docs/architecture.md) | The engine, morphing, mask eyes, `Look` |
| [docs/measurements.md](docs/measurements.md) | What was measured, the traps, regenerating `profiles.ts` |
| [docs/intro.md](docs/intro.md) | The arrival sequence, and why it plays only `idle` |
| [docs/interface.md](docs/interface.md) | Three-column scene, CSS traps, icons |
| [docs/export.md](docs/export.md) | The export bar, SVG/PNG/GIF/MP4, why the still export has no GIF |
| [docs/size.md](docs/size.md) | Both ship targets measured, and why the bake does not scale |
| [docs/i18n.md](docs/i18n.md) | The hand-rolled translation layer |

The README is for people arriving at the repository: what the project is, how to
run it, the component's API. Don't duplicate it here.

## Tests

`pnpm test` runs in `node` by default. **One file asks for a DOM** and says so on its first
line (`// @vitest-environment happy-dom`): `ui/capture.test.ts`, which mounts `BloubBot.vue`
to check the off-screen player — the exported render must be the component's own, not a
second drawing built beside it. That is also why `vitest.config.ts` carries the Vue plugin.
Keep the DOM per-file: a global DOM environment would slow the whole suite for one test.

`capture.test.ts` is the one that catches what nothing else can — the export defects are
invisible short of stepping through an MP4 frame by frame.

## Generated files

`src/bot/profiles.ts` is produced by `tools/extract-profiles.py` from the video's
frames (see [docs/measurements.md](docs/measurements.md)). Don't edit it by hand;
regenerate it.

`public/og.svg` is the social card's source, written by `pnpm og` (`tools/og.ts`).
It carries TEXT, so it carries the product name, and it has to follow a rename —
which is exactly what it failed to do the first time: the card still announced
「BLOUB」 long after the project stopped being bloub, while `og:image:alt` in
`index.html` described a card that did not exist. Rasterise with
`rsvg-convert -w 1200 -h 630 public/og.svg -o public/og.png`.

`public/favicon.svg` is **written by `pnpm favicon`** (`tools/favicon.ts`) and must
not be hand-edited. It went stale four times while it was transcribed — when the eye
became round (the paths), when the iris arrived (the layers), when the rest pose
changed (the matrices), when the catalogue lost the circle (the body) — and every
time it still *looked* right, which is the dangerous kind. The eye matrices in
particular survive a change of eye SIZE and do not survive a change of POSE.

Two things about it are deliberately NOT the engine's. Its **fill is flat** where the
app carries a gradient: a flat silhouette stays crisp at 16–48 px, and the dark-mode
inversion is one class swapping one `fill`, which a gradient only follows by being
defined twice. And its **frame is fitted to the body** rather than centred on the
origin, because the dome is not centred there and an icon has no room for a fifth of
empty space — the same distinction `DEMI_CADRE` makes in `export.ts`. Geometry comes
from the engine; framing and fill are the icon's own. The
matrices survive a change of eye SIZE — they carry the tangent frame, not the
dimensions — so check the `d` too when `EYE_W`/`EYE_H` move; that is what went stale
when the eye became round. `favicon.ico` (three PNGs, 16/32/48) and
`apple-touch-icon.png` (180) are rasterised from it, and the dark-mode block has to
come out first or the rasteriser bakes whichever scheme it happens to prefer.

`docs/shapes.svg`, `docs/eyes.svg`, `docs/poses.svg` and `docs/relief.svg` are the
contact sheets, all written by `pnpm board` (`tools/board.ts`). They are the art-direction gates — every shape at
rest, and every eye style across the expressions that deform the eye most — and they
are regenerated, not edited.

Its companion is `pnpm clearance`, which reports how close each shape brings an eye
to its own edge. `skins.test.ts` only asks that the eye stay IN; a shape can pass
that and still read as a notch. The measure to compare against is `cercle` (8.3 u),
and the tightest shape shipping today is `capsule` at 4.8 — that is the band.

`docs/demo.gif` and `docs/states.png` are the same idea: rendered by walking
`engine.sample(t)` and writing the SVG layers in `BloubBot.vue`'s order, then
`rsvg-convert` + `ffmpeg`. They are **not** browser captures: the browser pane
suspends `requestAnimationFrame` when hidden, so an animation can't be captured
there at all. To redo them, drive the engine, don't reach for a screenshot.

Same pane, related trap: when it is hidden it also **clamps `setTimeout` to ~1 s**
and freezes CSS transitions. So no sub-second timing can be measured there: a poll
written at 40 ms actually fires at 1 s, which reads as a delay the code never had.
Assert on the *state* instead (a `MutationObserver` still fires; an
`animation-delay` of `-1.5s` samples an animation mid-way while it is frozen).

## Moving the checkout

The repository has **linked worktrees** under `.claude/worktrees/`, and git records
the link between a worktree and its repo as an **absolute path, in both directions**:
the worktree's `.git` file points at `<repo>/.git/worktrees/<name>`, and that
directory's `gitdir` file points back at the worktree's `.git`. Renaming or moving
the checkout dangles both ends at once, and git then refuses to operate in either.

The fix is `git worktree repair`, run **from the new location** — it rewrites both
sides. Renaming `pill-clip-lab` to `cliplab` needed exactly this.

What does and doesn't survive the move:

- A **process's own working directory follows** the move, because it tracks the
  directory itself and not the path that named it. A shell sitting inside the
  checkout keeps working, and reports the new path.
- A **path captured at startup does not**. The dev server records its project root
  when it launches, so it looks for the old path afterwards and fails; the same goes
  for an editor or a language server. Restart them, and prefer stopping the dev
  server *before* the move rather than after.
- `node_modules` survives — pnpm's links inside it are relative.

## Useful URLs

- `#planche`: the 14 states side by side, frozen. The only safe path: it doesn't
  depend on any montage.
- `#arrivee`: replays the arrival. It otherwise only plays on a genuine visit, so
  without this link you can't see it again in a session.
- `#etat=<id>&stop`: opens one state, playback paused. It looks the state up in the
  user's montages, which are all editable: if they've removed it everywhere, the
  link doesn't apply.
