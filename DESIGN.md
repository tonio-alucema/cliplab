---
name: ClipLab
description: A quiet dark studio for expressive toon characters and looping animation.
colors:
  graphite: "#303230"
  primary: "#ecefe8"
  primary-ink: "#171a17"
  timeline-selected: "#eeeee8"
  accent: "#a9d9bb"
  focus: "#9fd3b5"
  text-action: "#c3ddb2"
  ink: "#eff0ed"
  secondary-text: "#b3b8ad"
  control-text: "#e3e6e0"
  utility-text: "#b2b6b1"
  line: "#ffffff12"
  sequence-surface: "#1a1d1a"
  field-surface: "#282d25"
  secondary-surface: "#292c29"
  secondary-hover: "#343834"
  secondary-ink: "#eef0eb"
  expression-selected: "#2d392d"
  chip-surface: "#272f22"
  chip-selected: "#3d4d32"
  chip-selected-ink: "#e4f3d6"
  view-selected: "#304136"
  view-selected-ink: "#c8ecd2"
  peach: "#ff986d"
  apricot: "#ffd092"
  mint: "#81d4c1"
  pale-mint: "#c6efd2"
  lilac: "#a79ce8"
  pale-lilac: "#d8cafa"
  face-ink: "#080909"
typography:
  headline:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-.025em"
  headline-compact:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-.025em"
  title:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    letterSpacing: "-.01em"
  body:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
  button:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 450
  label:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  helper:
    fontFamily: "'Helvetica Neue', Arial, sans-serif"
    fontSize: "12px"
    lineHeight: 1.6
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    lineHeight: 1.65
rounded:
  readout: "4px"
  icon: "7px"
  field: "10px"
  option: "12px"
  timeline: "13px"
  tab: "14px"
  expression: "15px"
  chip: "17px"
  stage-pill: "18px"
  button: "22px"
  panel-mobile: "23px"
  sequence: "24px"
  panel: "26px"
spacing:
  tight: "4px"
  small: "6px"
  control: "8px"
  grid: "10px"
  label: "12px"
  compact: "14px"
  group: "16px"
  gutter: "18px"
  wide-gutter: "22px"
  inspector: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "9px 17px"
  button-primary-hover:
    backgroundColor: "#fff"
  button-secondary:
    backgroundColor: "{colors.secondary-surface}"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "9px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-quiet:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "9px 17px"
  button-text:
    textColor: "{colors.text-action}"
    padding: "5px 0"
  button-icon:
    textColor: "{colors.utility-text}"
    rounded: "{rounded.icon}"
    width: "32px"
    height: "32px"
  text-field:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.control-text}"
    rounded: "{rounded.field}"
    padding: "7px 10px"
    height: "37px"
  option-chip:
    backgroundColor: "{colors.chip-surface}"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.chip}"
    padding: "7px 11px"
  option-chip-selected:
    backgroundColor: "{colors.chip-selected}"
    textColor: "{colors.chip-selected-ink}"
    rounded: "{rounded.chip}"
    padding: "7px 11px"
  inspector-tab:
    rounded: "{rounded.tab}"
    padding: "8px 0"
    height: "58px"
  integration-card:
    backgroundColor: "#ffffff02"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.timeline}"
    padding: "13px"
  expression-card:
    backgroundColor: "#ffffff02"
    rounded: "{rounded.expression}"
  expression-card-selected:
    backgroundColor: "{colors.expression-selected}"
    rounded: "{rounded.expression}"
  sequence-beat:
    backgroundColor: "#272c26"
    rounded: "{rounded.timeline}"
  sequence-beat-selected:
    backgroundColor: "{colors.timeline-selected}"
    textColor: "#252d23"
    rounded: "{rounded.timeline}"
---

# Design System: ClipLab

## Overview

**Creative North Star: "The Character Studio"**

ClipLab is a quiet dark studio: a graphite canvas, a transparent header with the supplied white logo, and separate charcoal cards leave room for the authored character. Regular sans-serif headings, compact controls, sage selections, and a few white action surfaces keep the surrounding interface restrained.

The character carries the expressive range. Real geometry supports smooth two-color fills and sharply divided toon lighting, with circular eyes, substantial mouths, and optional animated details. The stage, expression library, and timeline share the character renderer so that the same face reads consistently while it is edited, sequenced, and exported. This refresh retains the established studio identity and character principles while replacing the earlier pale surfaces and blue action language with the user-approved dark world.

**Key Characteristics:**

- Graphite gutters separate independently rounded charcoal surfaces.
- The transparent header carries the supplied white ClipLab logo.
- White highlights primary actions and the active timeline beat; sage identifies quieter editing states.
- Compact regular sans-serif type supports a character-led interface.
- Circular facial geometry and crisp toon bands remain consistent across rendering contexts.

## Colors

The interface combines subtly green charcoal neutrals with warm white actions and quiet sage states; editable character colors provide the stronger hues.

### Primary

- **Warm white action** (`primary`): primary action fills, paired with `primary-ink`. Hover approaches pure white. The timeline uses its own `timeline-selected` white for the active beat.
- **Sage accent** (`accent`): native range, checkbox, and progress accents. `focus` supplies the recurring keyboard outline; `text-action` identifies text actions.
- **Selection surfaces:** expression cards, option chips, and stage controls use their recorded component colors. They form a related family, not a single interchangeable selected-state token.

### Secondary

- **Peach / apricot**, **mint / pale mint**, and **lilac / pale lilac**: starting character pairs shared by the character definitions and palette picker. These are editable content defaults.
- **Face ink**: the default near-black eye and mouth color, also editable per character.

### Neutral

- **Graphite:** the page canvas visible through the header and around all three studio cards.
- **Charcoal surfaces:** the sequence uses `sequence-surface`; the preview and inspector use subtly graded charcoal fills from the component CSS. Those interface gradients are intentionally quiet.
- **Ink / control text / secondary text / utility text:** main text, field and numeric values, helper copy, and utility icons respectively.
- **Fine line:** a translucent white divider. Most component borders are similarly subtle white overlays, with a stronger sage boundary for active choices.

**The White Anchor Rule.** Keep the primary action and current timeline beat white while using the shipped sage variants for quieter editor selection. Character colors remain authored content.

## Typography

**UI Font:** the Helvetica Neue, Arial, sans-serif stack recorded in the frontmatter.
**Code Font:** the recorded system monospace stack.

**Character:** regular, tightly set sans-serif UI text. The supplied logo provides the wordmark; it is not recreated with typed lettering. This build establishes panel headings, not a separate display-font role.

### Hierarchy

- **Headline:** main inspector titles. The compact variant appears in the detailed expression editor.
- **Title:** section headings for grouped controls; timeline headings use a slightly lighter weight (450).
- **Body:** the root text size. Most component copy is locally reduced to preserve editor density.
- **Button:** short action labels, usually with an icon and a compact gap.
- **Label:** field and beat names. Expression card names are slightly lighter (450).
- **Helper:** panel descriptions and supporting explanations, with comfortable line spacing.
- **Code:** integration examples. Duration, dimensions, and range readouts use tabular figures where implemented.

**The Quiet Type Rule.** Use size, spacing, and modest weight changes to separate controls and headings. Keep the expressive character as the visual focus.

## Layout

The desktop studio fills the viewport, with a minimum height (680px), a transparent header (83px), and page padding (0 22px 22px). The workspace is a flexible left column beside an inspector (376px), separated by a visible graphite gutter (18px). The left workbench stacks a flexible preview with a minimum height (260px) above a sequence card (262px), also with an (18px) gap. The preview contains a character selector row (59px); the sequence combines size presets and the timeline. The inspector scrolls independently with content padding (24px). These measurements describe the shipped studio rather than requiring this exact composition for every future ClipLab surface.

At widths of at least (1500px), the inspector grows to (410px), workspace and workbench gaps grow to (22px), page padding becomes (0 28px 26px), and inspector padding becomes (27px 28px). At widths up to (1150px), the inspector narrows to (332px), gaps shrink to (14px), page padding becomes (0 16px 16px), and inspector padding becomes (21px 19px). Supporting header copy, save status, character count, and secondary timeline copy disappear to preserve working space.

At widths up to (820px), the page scrolls vertically and the inspector follows the workbench. The header is (72px), with ordinary document positioning. Workbench rows become (490px) and (262px), separated by (16px); all three main cards use the mobile panel radius. The inspector has a minimum height (660px) and its content participates in page scrolling. Undo controls disappear. Expression cards use four columns, and the detailed editor footer sticks to the viewport bottom.

At widths up to (480px), page padding becomes (0 10px 16px), the header logo renders at (138px) inside its cropped wrapper, and Import disappears from the header. Preview and sequence heights become (435px) and (265px), with a (13px) gap; the preview selector row becomes (55px). The size-strip explanation is hidden, the size buttons distribute across the width, and the expression library returns to two columns. Inspector padding becomes (22px 20px). Timeline items retain a minimum width (145px) and scroll horizontally instead of compressing their controls.

Use the repeated spacing steps from the frontmatter for local groups. Two-column sliders, three body-shape choices, four inspector tabs, and four face-preset columns recur. This is a compact tool: helper copy should remain legible, and optional information should yield before primary controls.

**The Visible Gutter Rule.** Preserve graphite space between the preview, sequence, and inspector cards. Keep the header transparent so the workspace reads as independent surfaces.

## Elevation & Depth

The interface uses tonal layering, generous outer rounding, and faint ambient shadows. Preview and inspector gradients remain close in value; the separate sequence surface is flat. Inner controls mostly use fill and fine border changes rather than floating independently. The character has its own illustrative depth through real geometry and crisp bands, independent of interface shadows.

### Shadow Vocabulary

- **Floating panel:** soft ambient separation (`0 8px 16px #15181520`), shared by preview, sequence, and inspector.
- **Primary action:** restrained lift (`0 2px 4px #0000001a`).
- **Current timeline beat:** slight lift under the white selection (`0 3px 7px #0000001a`).
- **Toast:** temporary feedback elevation (`0 10px 30px #00000044`).

**The Crisp Lighting Rule.** Blend character body colors smoothly while keeping toon lighting boundaries hard. The camera-fixed candle mode uses four slightly offset radial bands; the selectable directional mode uses three normal-based bands. The optional ground shadow has a crisp elliptical boundary. Do not transfer this character-lighting constraint into a ban on the interface's soft ambient shadows.

## Shapes

Outer panels use broad rounded corners, buttons and options use pill-like shapes, and fields and smaller cards use intermediate radii. The radius vocabulary is deliberately varied: fields, icon controls, expression cards, timeline beats, and outer panels each keep their established geometry. Palette swatches, eye dots, small indicators, and playback controls use circles. Thin SVG line icons have rounded caps and joins.

The body silhouettes remain a capsule with a width-to-height ratio (1:2), a square-proportioned end cap with a rounded lower edge, and a sphere. Face mapping compensates for the face mesh aspect ratio so default dots and half-circle eye arcs remain circular head-on. Eye-height, blinking, and authored pose changes can still alter the expression. Optional cheek cutouts are circular transparent areas that reveal the shaded body; they are not a painted flat body-color patch.

**The Round Face Rule.** Start from circular dot eyes and half-circle arcs, with rounded stroke ends and substantial mouth contours. Keep facial proportions relative to the authored body and preserve the circular geometry when the face is mapped to it.

## Components

### Buttons

Pill-shaped actions combine a short label with a line icon. Primary buttons use warm white with dark text; secondary buttons use a charcoal fill and faint border; quiet actions expose a translucent white background on hover. Text actions use pale sage and underline on hover. Utility icon buttons remain compact rounded squares.

Shared action padding is (9px 17px), with a minimum height (38px) and icon gap (8px). Primary hover becomes white; secondary hover lightens the fill and strengthens the border. Disabled buttons reduce opacity (0.4) and use a non-interactive cursor. Keyboard focus uses an external sage outline (3px, offset 3px). Color, border, background, and opacity transitions last (150ms); the reduced-motion media query removes CSS transitions.

### Chips

Expression options wrap into compact rounded choices, with a charcoal-green fill, muted text, and a sage active variant. Editor beat selectors use a denser row with their own stronger selected fill. Size presets are clickable pills: (12, 16, 24, 48, 96px) sets the actual displayed CSS size in the main stage, while Fit restores the large preview. Their state changes are visual as well as semantic through pressed-state attributes.

### Cards / Containers

The three outer cards use the layout and elevation vocabulary above. Expression cards are image-first choices with shared-renderer thumbnails and a compact name/beat-count footer. Selection changes their fill to the recorded expression-selected surface and strengthens the sage border; it does not add a glow. A visible Edit selected action and double-click both enter detailed editing. Shape choices, animation rows, and integration choices carry related subdued selection treatments with their own established values.

Timeline beats have an upper selection area and lower duration/order controls. The active beat turns white and its text turns dark; inactive beats retain charcoal fills. The track scrolls horizontally. The circular playback button uses a pale sage fill with a dark glyph for readable contrast. Add beat uses a dashed boundary and its own disabled opacity (0.3).

### Inputs / Fields

Text and select fields use the field-surface fill, a faint white border, the field radius, and a height (37px). Focus shifts the fill and sage border; keyboard focus also supplies a visible outline (2px, offset 2px). Range and checkbox controls use the sage accent. Numeric readouts are compact dark rounded rectangles with tabular figures.

Switches use a small track (30px by 17px) and circular white knob (11px). Checked state changes the track to sage and translates the knob (13px). Their hidden input retains a visible focus outline on the track. The build does not establish a reusable inline field-error appearance.

### Navigation

The transparent header uses `public/cliplab-logo-white.svg`, a quiet studio description, utility actions, and a white Export button. Character tabs sit inside the preview card as rounded thumbnail-and-name choices. Inspector navigation has four icon-over-label controls; active state changes fill and text color without an underline. The navigation remains part of its card on mobile while the layout stacks vertically.

### Character Rendering

Use the same 3D renderer for the live stage, expression thumbnails, timeline previews, and exports. White eye dots are optional and increase black eye radius (20%); the white dot itself appears at full detail. Broad open, grin, and crying mouths use substantial dark outlines with optional clipped teeth and tongue details. Tear drops, hearts, sparkles, and sleep marks have deterministic eased entrance, movement, and exit, so their timing survives export.

Detail follows displayed CSS size independently of device pixel ratio: below (16px), show the body only; from (16px through 24px), show eyes; above (24px), show the complete face and props. True front removes rendered view and pose rotation while retaining authored pose data. Lock position suppresses floating and breathing without suppressing facial or prop animation. Existing saved projects receive defaults for newly introduced settings; their authored expressions remain intact.

## Do's and Don'ts

### Do:

- **Do** preserve the graphite canvas, transparent header, supplied white logo, and visible spacing between the three studio cards.
- **Do** use white for primary actions and the active timeline beat, with the existing sage variants for quieter editor states.
- **Do** use the quiet UI type hierarchy and maintain legible helper text and keyboard focus.
- **Do** keep character colors editable and preserve smooth fills alongside crisp lighting bands.
- **Do** keep circular base eyes, transparent circular cheek cutouts, substantial mouth contours, and eased supporting details consistent across the shared renderer.
- **Do** choose facial detail from displayed CSS size and preserve authored pose data when toggling view controls.

### Don't:

- **Don't** reintroduce the obsolete pale inspector, blue primary-action palette, or an opaque header bar into this dark studio.
- **Don't** merge the three studio cards into one continuous framed surface or apply panel shadows to every inner control.
- **Don't** replace the supplied logo with typeset lettering or create a separate display treatment from the compact UI headings.
- **Don't** blur toon-band or ground-shadow boundaries; soft ambient interface shadows and smooth body-color gradients remain valid parts of this world.
- **Don't** enlarge default facial detail to compensate for an incorrectly scaled preview, or paint cheek cutouts with a flat sampled body color.

Not canonized: inherited (9–10px) micro-metadata is not a reusable legibility standard. The UI sans stack is documented only for compact tool roles, not as a system display face.
