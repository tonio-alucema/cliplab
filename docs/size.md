# The two ship targets, measured

Phase 1 of the plan exists because the size claim was unmeasured. It is measured
now, and the answer reverses the plan's assumption: **the JS runtime is the light
one.** The baked SVG is light only for a resting loop, and grows to hundreds of
kilobytes as soon as the body actually animates.

Everything below is reproducible with `pnpm size`. It writes the artifacts to
`dist-size/` (gitignored) and prints every table on this page.

## The numbers

Gzip level 9, self-contained artifacts, no server compression assumed.

| Target | Artifact | gzip |
|---|---|---|
| **JS runtime** | engine + one character + DOM painter | **11.1 kB** |
| **JS runtime** | the same, plus montage playback | **11.4 kB** |
| **Baked SVG** | `idle` alone, 3 s loop | **6.5 kB** |
| **Baked SVG** | 9 states, 18.4 s, no decor | **139 kB** |
| **Baked SVG** | the default cycle, 14 states, 31.2 s | **825 kB** |

The baked rows use an adaptive key grid at a 0.5-unit tolerance — half a percent
of the ball's radius, which is half a pixel on a 200 px avatar. That is the
fairest setting: it is visually exact, and it is the cheapest grid that is.

Both targets now carry everything that ships: the dome, the iris, the relief
gradient and the pitch foreshortening. The figures rose by a few percent when
those arrived, and the conclusion did not move an inch.

## Phase 3's cues cost almost nothing to bake — but had to be emitted

The plan asks that each depth cue be tested against the bake *as it lands*. Doing
it turned up the failure mode that instruction exists for, twice: **the baker was
silently dropping cues.** It had no idea the eyes had layers, and none that the
body had a gradient, so it produced a flat body with hollow eyes and reported a
perfectly healthy size. Nothing failed. The artifact was simply not the product.

Worse, it was baking a bot nobody has — no eye style, and the circle, which left
the catalogue. A size probe that measures the wrong character is not a measurement.

With both cues emitted, and the shipping defaults in place, the cost is small:

| | before the cues | with them |
|---|---|---|
| `idle`, 3 s, 30 keys/s | 51.0 kB | 52.5 kB |
| 9 states, 30 keys/s | 377 kB | 390 kB |

So roughly 1–3 %. That is what "bakeable" was supposed to mean and now demonstrably
does — a gradient is not a path, so it has no command signature to break, and its
centres, radius and stops are numbers. The iris layers ride the same 64-point
correspondence the body does.

The adaptive grid samples the relief as well as the body and eyes. It has to: the
gradient follows the gaze, so it moves during the long stretches when the body is
merely breathing, and a grid chosen on the body alone would under-sample it. In
practice it costs almost nothing — 146 keys became 150 on the 9-state sequence —
which is itself the useful finding: the relief is slow next to everything else.

## Why the bake does not scale

The cost model is one line: **a key restates the whole body path, and the body
path is ~2.4 kB of text.** Sixty-four points, four numbers each, two decimals.
Nothing else in a frame comes close — the eyes are two matrices, the notification
is three numbers.

So the bake's weight is `keys × 2.4 kB`, and the only question is how few keys
the motion tolerates. At rest, very few: the silhouette moves 1.17 units over the
whole loop, so five keys hold it to half a unit and the file is 5.4 kB. During a
state morph the silhouette crosses the frame, and no sparse grid survives it —
uniform keys at 6/s miss by 48 % of the radius, which is not a rounding error but
a different shape.

Two things make it worse than the plan assumed.

**The engine's morphs are exponential ease-outs; SMIL interpolates linearly.**
The plan's premise — shared `PROFILE_SAMPLES` gives point-for-point
correspondence, so morphing is a linear interpolation of radii — is true about
the *geometry* and silent about the *timing*. Linear interpolation between two
correct keys still traces the wrong path through time, and the error is largest
exactly where the motion is fastest. Keys have to be dense enough to approximate
the curve, not just to hit its endpoints.

**The orbit arcs cannot be interpolated at all.** SMIL animates `d` only when
every key shares the same sequence of path commands. The body clears that bar
with one signature across the whole cycle, and so do the eyes and the burst
particles. The arcs do not: 170 distinct command signatures on the front halves
and 179 on the back ones, because the split between the visible and hidden halves
of a 3D ellipse changes structure as the ring turns. They can only be *switched*,
frame by frame, so the four arc-bearing states (`play`, `orbit`, `burst`,
`comet`) pay full frame rate no matter how sparse the rest of the grid is. That
alone is why the 14-state row is 6× the 9-state one.

`src/ui/export.ts` already said as much, in the comment explaining why a cycle
has no animated-SVG format: the body path weighs 2.5 kB and six hundred frames
would make 1.5 MB. That comment was right, and it was measured on the same
reasoning this page now confirms end to end.

## Why the runtime is cheap

10.9 kB gzipped is the *whole* engine: all fourteen states, the decor, the eye-fit
table, the expression set, the shape library, the profiles. Nothing was trimmed
to get that number, and the tree-shaking that a consumer gets for free is already
in it.

It is worth saying plainly, because the plan budgeted for the opposite: `src/bot/`
is ~107 kB of TypeScript, and that compresses to a tenth of it. Source size is a
poor predictor here — the folder is mostly comments (the measurements and their
traps) and numeric tables that gzip extremely well.

## What this means for the phases

**The runtime should be the primary target, and the bake the special case.** That
is the reverse of the plan's ordering, and the reasons the plan gave for
preferring the bake — "lighter than a video clip", no runtime — are satisfied by
both at rest and by neither for a montage, since 792 kB is video territory.

Concretely:

- **A looping embed** (an avatar breathing and blinking on a page) is the bake's
  home ground: 5.4 kB, no JavaScript, no runtime to ship. Keep it.
- **A sequence embed** should ship the runtime: 11.3 kB plays *any* montage, where
  a baked 31-second cycle is 792 kB and plays only itself. The runtime also wins
  on the second cycle, which costs it nothing.
- **Phase 3 must test each depth cue against the bake as it lands**, as the plan
  says — and the arc result shows what the failure looks like. A cue whose SVG
  changes command structure per frame does not merely cost more, it leaves the
  interpolable set entirely.
- **The Phase 5 size budget in CI** now has its baseline: the five rows above.

## Levers, if a sequence bake is ever wanted

None of these were applied to the numbers above; they are the headroom.

- **Fewer points on export.** 64 samples is what morphing needs, not what the eye
  needs. Resampling to 32 for a bake halves every key.
- **One decimal instead of two.** At `RAYON = 100`, 0.1 unit is a tenth of a
  percent of the radius. Worth roughly a fifth of the path text.
- **`keySplines` matching the state's own ease-out.** SMIL can interpolate along a
  cubic Bézier; the engine's morphs are exponential ease-outs with known
  constants. Matching them would cut keys during morphs, which is where all the
  keys are.
- **Per-state loops rather than one montage.** Five small SVGs that each loop are
  a different product from one long timeline, and vastly cheaper.

## Method, and what the numbers do not cover

`tools/size/bake.ts` drives `engine.sample(t)` directly and writes the SVG layers
in `BloubBot.vue`'s order — the same approach `docs/demo.gif` uses, and for the
same reason: the browser pane cannot capture an animation. **The Phase 5 baker
should go through the component instead**, as `capture.ts` does, so that there is
one source of drawing. This one is a measurement probe, not that baker.

The body is emitted once in `<defs>` and referenced by `<use>` from both the mask
and the paper backing. Without that it would be animated twice and every number
here would be larger — worth keeping in the real baker.

Fidelity is reported as the largest deviation, in viewBox units, between the
baked path and `engine.sample(t)` at 60 Hz, simulating SMIL's linear
interpolation number by number. It is exact for the body. For the eyes it is a
proxy: their matrices animate through CSS, which interpolates decomposed
transforms rather than raw matrix entries, so the true eye error is slightly
different from the one the grid was chosen against. The grid counts eyes at full
weight anyway, because a blink lasts 0.18 s and is what sets the density where
the body asks for nothing.

Not covered: the over-the-wire embed test (Phase 5), Brotli, and the arcs under a
`keySplines` grid.
