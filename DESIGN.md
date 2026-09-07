---
name: ClipLab
description: A compact studio for expressive toon characters and looping animation.
colors:
  accent: "#4967d6"
  accent-soft: "#edf1ff"
  selected-surface: "#f0f3ff"
  ink: "#27313b"
  secondary-text: "#596675"
  line: "#e4e7eb"
  surface: "#fff"
  workbench: "#f9fafb"
  stage-slate: "#171e25"
  stage-light: "#e9eef0"
  peach: "#ff986d"
  apricot: "#ffd092"
  mint: "#81d4c1"
  pale-mint: "#c6efd2"
  lilac: "#a79ce8"
  pale-lilac: "#d8cafa"
  face-ink: "#172023"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "25px"
    fontWeight: 640
    lineHeight: 1.3
    letterSpacing: "-.035em"
  headline-compact:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 640
    lineHeight: 1.3
    letterSpacing: "-.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 630
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
  button:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 570
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 570
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    lineHeight: 1.65
rounded:
  micro: "4px"
  chip: "6px"
  field: "7px"
  button: "8px"
  card: "9px"
  panel: "10px"
spacing:
  tight: "4px"
  small: "6px"
  control: "8px"
  grid: "10px"
  label: "12px"
  group: "16px"
  section: "23px"
  inspector: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "#3b57c4"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "#3d4753"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-quiet:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "9px 14px"
  button-text:
    textColor: "{colors.accent}"
    padding: "5px 0"
  button-icon:
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.field}"
    width: "32px"
    height: "32px"
  text-field:
    backgroundColor: "#f9fafc"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "7px 10px"
    height: "37px"
  option-chip:
    rounded: "{rounded.chip}"
    padding: "7px 11px"
  option-chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "#4a65c9"
    rounded: "{rounded.chip}"
    padding: "7px 11px"
  integration-card:
    backgroundColor: "#fafbfd"
    rounded: "{rounded.button}"
    padding: "13px"
  integration-card-selected:
    backgroundColor: "{colors.selected-surface}"
    textColor: "#5a74d1"
    rounded: "{rounded.button}"
    padding: "13px"
---

# Design System: ClipLab

## Overview

**Creative North Star: "The Character Studio"**

ClipLab is a working character studio with a slate preview, white controls, blue selection, crisp outlines, and expressive toon characters. Its identity is carried by the authored character; the surrounding interface uses compact, familiar controls and a restrained system UI font.

The material distinction is deliberate: the controls use quiet surface changes and borders, while the characters combine smooth two-color fills with discrete lighting bands. The studio, expression thumbnails, and size previews all use the same character renderer, preserving the character’s appearance while it is edited and sequenced.

**Key Characteristics:**

- Slate preview and white editing surfaces.
- Blue identifies selection and primary actions.
- Compact controls with fine outlines and modest corner rounding.
- Smooth character color blending with crisp toon shading.
- Character detail follows displayed CSS size.

## Colors

The interface uses cool neutral surfaces and a blue action accent; the character palette introduces peach, mint, lilac, and other user-selected colors.

### Primary

- **Selection blue** (`accent`): primary buttons, current inspector tabs, range controls, and text actions.
- **Pale selection blue** (`accent-soft`) and **selected surface** (`selected-surface`): existing complementary fills for option chips and selected cards. These are separate source values; the build does not have one universal selected-card border color.

### Secondary

- **Peach / apricot**, **mint / pale mint**, and **lilac / pale lilac**: paired starting character fills reused in the palette picker and default character definitions. These are content defaults and remain editable.
- **Face ink**: the default face color shared by the starting characters; it remains an editable character setting.

### Neutral

- **Ink**: main UI text and inherited field text.
- **Secondary text**: the repeated final-build value for helper copy, field labels, inactive light-surface tabs, numeric metadata, and utility icons. Dark-stage labels retain their own lighter treatment.
- **White surface**: header, character bar, inspector, buttons, and size-preview strip.
- **Workbench**: the slightly toned timeline and surrounding work area.
- **Fine line**: structural dividers between the main interface regions.
- **Slate stage / light stage**: actual preview backgrounds, also used by the background selector. The third preview option is a transparency checker, built from four aligned CSS gradients.

**The Selection Blue Rule.** Use the existing blue accent for primary actions and active controls; pair selected cards with a pale blue fill and visible border. Character body colors remain authored content.

## Typography

**UI Font:** the system sans-serif stack recorded in the frontmatter.
**Code Font:** the system monospace stack recorded in the frontmatter.

**Character:** tightly set, compact UI type. The source uses one sans-serif family with size and weight changes rather than a contrasting display face. No reusable display-font role is established by this build.

### Hierarchy

- **Headline:** primary inspector titles; the compact variant appears in the expression editor. These are UI panel headings.
- **Title:** section headings for grouped controls.
- **Body:** the root text size, with the majority of component copy locally reduced for editor density.
- **Button:** primary, secondary, and quiet action labels.
- **Label:** expression names and timeline beat names.
- **Supporting UI:** numeric values and secondary labels are generally (11–12px). Some micro-metadata is (9–10px); those smallest sizes are not a reusable body-text standard. The final build uses the secondary-text color for this metadata on light surfaces.
- **Code:** integration snippets, with the separate monospace stack.

**The Compact Type Rule.** Use the compact UI hierarchy for control names, values, and panel titles. Time, size, and numeric settings use tabular figures where the source provides them.

## Layout

The current studio fills the desktop viewport, with a fixed-height header (64px) and a workbench beside an independently scrolling inspector (400px wide). The left workbench contains a character selector, a flexible stage, a size-preview strip, and a compact timeline. This describes the shipped studio surface; it is not a required composition for every future ClipLab page.

The default workbench rows are (58px), a stage with a minimum of (260px), (118px), and (208px). At viewport widths of at least (1500px), the inspector grows to (430px), the stage minimum becomes (300px), and the timeline becomes (220px). At widths up to (1150px), the inspector narrows to (350px) and auxiliary header copy is hidden.

At widths up to (820px), the document scrolls vertically: the workbench comes first and the inspector follows. The header becomes sticky (58px); inspector tabs stick below it. The inspector content is capped at (640px) and the stage height is (430px). At widths up to (480px), the stage becomes (370px), the size-strip explanation is hidden, and expression cards return to two columns. Between those narrow-phone and stacked-layout breakpoints, the expression grid uses four columns; on desktop it uses two.

Use the observed compact spacing vocabulary: close groups rely on the smaller frontmatter steps; control groups use medium separation; inspector sections use the larger steps. Two-column slider groups and paired actions, three shape choices, and four inspector tabs recur in the source. Timeline blocks remain in a horizontally scrollable track on narrow screens.

## Elevation & Depth

Interface surfaces are primarily separated by color, fine borders, and spacing. They do not all float: the header, stage, timeline, and inspector form adjacent regions. Small ambient shadows support selected expression cards, selected export tabs, switch knobs, and temporary toast feedback. The renderer gives the character its own depth through real geometry, three discrete shade bands, and an optional sharply bounded ellipse beneath it.

### Shadow Vocabulary

- **Selected expression:** a soft blue outer outline (`0 0 0 2px #e8edff`). It strengthens the active card boundary without lifting every card.
- **Selected timeline block:** a fine blue outer outline (`0 0 0 1px #9dadf322`).
- **Raised export tab:** a very small ambient shadow (`0 1px 4px #25364f0b`).
- **Switch knob:** subtle separation from its track (`0 1px 2px #0000000c`).
- **Toast:** temporary feedback above the interface (`0 8px 30px #25364f16`).

**The Crisp Lighting Rule.** Blend body colors smoothly, but retain the renderer’s discrete lighting bands and sharply bounded ground shadow. Smooth fill is an approved material, not a lighting blur.

## Shapes

Controls use modest rounded corners, not one radius everywhere. The frontmatter records the repeated scale: the smallest rounding supports readouts and micro-controls, the middle steps support chips, fields, and buttons, and the larger steps support grouped choices and containers. Expression preview cards have their own observed corner radius (11px). Circles are used for palette swatches, small state indicators, and the orientation display.

The authored body geometry has three silhouettes: a capsule with a (1:2) width-to-height ratio, a square-proportioned end cap, and a sphere. The end cap’s nominally straight lower end keeps a rounded edge. Compact eyes and mouths are mapped to the curved body; optional elevation lifts them onto a larger invisible shell. These character forms are distinct from control-container geometry.

## Components

### Buttons

Compact actions combine an icon and short label with an (8px) gap. Filled blue identifies the primary action; secondary actions use a white fill and fine gray outline; quiet actions expose their background on hover; text actions use blue text and an underline on hover. Icon-only utility buttons use small rounded square hit areas.

Primary and secondary hover states adjust fill and border color. Disabled buttons reduce opacity (0.4) and use a non-interactive cursor. The shared keyboard treatment is an external focus outline (3px, offset 3px), except that the current text-field rule suppresses the outline and changes its border on focus. This inconsistency is not a model for future fields.

### Chips

Expression options and editor beat selectors are compact bordered choices with pale blue active fills. Options wrap rather than forcing the inspector wider. Their active borders and text colors come from each existing component variant; do not infer a new universal token from their near-matching values.

### Cards / Containers

Expression cards are image-first choices: the shared renderer supplies a thumbnail, and a compact footer supplies the expression name and beat count. Selection adds a blue border and outer outline. The expression library places a visible “Edit selected” text action above the grid; selecting and detailed editing are distinct interactions. Shape choices, animation rows, and integration choices share the same pale neutral-to-blue selection language with their own geometry. The timeline uses compact bordered blocks with a main selection area and a lower row for duration and ordering actions.

### Inputs / Fields

Text and numeric fields use a pale cool fill, a fine gray border, and modest rounding. Their border shifts blue and fill turns white on focus. Range controls place a label and numeric readout together above the track. Paired sliders are also used for left/right eye size, placement, and rotation; link and mirror switches expose whether the adjustments move together. Native checkboxes use the accent color. Switches use a small blue track when active, a gray track when inactive, and a white circular knob.

Control transitions run for (150ms). The reduced-motion stylesheet disables transitions and smooth scrolling; playback also starts paused when the user requests reduced motion.

### Navigation

The inspector has four evenly distributed icon-and-label tabs. The active tab uses blue text and a short bottom rule. Character selection uses horizontally arranged thumbnail-and-name tabs with a neutral selected fill. Narrow layouts keep character tabs horizontally scrollable and move the inspector below the workbench.

### Character preview and responsive detail

The stage is a real 3D preview with pointer rotation, a synchronized orientation control, a reset action, zoom, and three background choices. Character thumbnails are rendered from the same definition as the stage. The palette can blend smoothly; the toon shader applies three light multipliers (1.0, 0.81, 0.64) with hard transitions. That relationship is the character material rule, rather than a CSS gradient recipe for arbitrary interface panels.

Below (16 CSS px), render the colored body only. From (16–24 CSS px inclusive), show eyes without the mouth or props. Above (24 CSS px), show the full face and expressive detail. Device pixel ratio does not select the detail level. The existing size strip demonstrates this at five sizes (12, 16, 24, 48, and 96 CSS px).

## Do's and Don'ts

### Do:

- Do use blue selection with visible outlines and pale fills across the existing control families.
- Do preserve compact UI headings, sentence-case labels, and tabular numeric readouts.
- Do use the shared renderer for character previews and preserve size-dependent facial detail.
- Do preserve all three body silhouettes and the end cap’s softened lower edge.
- Do keep keyboard focus visible and honor the existing reduced-motion behavior.

### Don't:

- Don't replace the approved smooth body gradient with flat color as a blanket style rule.
- Don't soften the character’s toon lighting bands or ground-shadow boundary with blur.
- Don't promote custom character colors into global interface selection colors.
- Don't copy the smallest metadata sizes into body copy or text-glyph controls into an icon standard.

**Not canonized:** the smallest micro-metadata sizes as body-text standards, text-glyph zoom controls, and the system-set wordmark as a reusable display treatment. These are observed implementation limitations, not rules for future surfaces. The current text-field focus-outline override is also excluded as a reusable behavior.

<!-- Recorded from src/studio/studio.css, StudioApp.vue, CharacterStage.vue, StudioIcon.vue, renderer.ts, and model.ts. PRODUCT.md and the index.html direction contract establish the approved world; rendered source controls the recorded implementation. -->
