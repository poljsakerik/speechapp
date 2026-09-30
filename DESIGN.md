---
name: MicMane
description: A daylight editor for your voice, from a company that could exist in Night City.
colors:
  paper: "oklch(0.985 0.003 80)"
  surface: "oklch(1 0 0)"
  sunken: "oklch(0.965 0.004 80)"
  line: "oklch(0.905 0.005 75)"
  line-strong: "oklch(0.8 0.006 70)"
  ink: "oklch(0.19 0.008 55)"
  ink-2: "oklch(0.4 0.01 60)"
  ink-3: "oklch(0.52 0.01 65)"
  graphite: "oklch(0.22 0.004 60)"
  graphite-deep: "oklch(0.17 0.003 60)"
  graphite-line: "oklch(0.33 0.004 60)"
  on-graphite: "oklch(0.97 0.002 80)"
  on-graphite-muted: "oklch(0.85 0.004 70)"
  glass: "oklch(0.7 0.175 48)"
  glass-hot: "oklch(0.8 0.15 62)"
  glass-ink: "oklch(0.5 0.15 42)"
  f-rate: "oklch(0.86 0.075 220)"
  f-rate-ink: "oklch(0.47 0.1 228)"
  f-volume: "oklch(0.83 0.085 295)"
  f-volume-ink: "oklch(0.47 0.14 295)"
  f-pitch: "oklch(0.85 0.075 355)"
  f-pitch-ink: "oklch(0.5 0.15 360)"
  f-tonality: "oklch(0.9 0.085 88)"
  f-tonality-ink: "oklch(0.5 0.1 72)"
  f-pauses: "oklch(0.88 0.075 160)"
  f-pauses-ink: "oklch(0.47 0.09 162)"
  destructive: "oklch(0.55 0.19 32)"
typography:
  display:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.5vw, 4.25rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.035em"
    fontVariation: "\"wdth\" 125"
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.8vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.03em"
    fontVariation: "\"wdth\" 125"
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 125"
  monitor:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 125"
  body-lead:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.625
    fontVariation: "\"wdth\" 100"
  body-sm:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
  time:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.3
    fontFeature: "\"tnum\""
rounded:
  hair: "2px"
  tick: "3px"
  sm: "3px"
  md: "4.8px"
  lg: "6px"
  xl: "9.6px"
  full: "9999px"
spacing:
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
  card: "20px"
  card-sm: "12px"
  section: "80px"
  section-wide: "112px"
  container: "1320px"
  grid-gap: "64px"
  list-gap: "36px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-ghost:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-glass:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-glass-hover:
    backgroundColor: "{colors.glass-hot}"
  button-graphite:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.on-graphite}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  badge-foundation-volume:
    backgroundColor: "{colors.f-volume}"
    textColor: "{colors.f-volume-ink}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  badge-sample:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card}"
  recorder:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.on-graphite}"
    rounded: "{rounded.xl}"
    padding: "40px"
---

# Design System: MicMane

## Overview

**Creative North Star: "The Daylight Braindance Editor"**

MicMane is built like a professional editing suite that a Night City company would sell for the human voice: white chrome, gray and black structure, and a timeline you can scrub. Everything reads as an instrument. Headlines are set in a wide, heavy Archivo that feels stamped onto the product; times and measurements run in Martian Mono with tabular figures; body copy stays at a normal width and a calm gray.

Color is rationed. The canvas is a nearly achromatic white. Five pastel foundation hues (rate, volume, pitch, tonality, pauses) appear only where a foundation is actually present: a lane, a swatch, a badge, a highlighted word. Dark surfaces are neutral graphite, never brown. The single warm color in the system is orange glass: the playhead, the recorder's glass, the slider thumb, the progress fill, the focus ring. When nothing is live, the glass is unlit graphite.

State is carried by stroke rather than by extra color: a solid leader is a clear note, a dashed one is tentative; a filled pin is a strength, an open ring an improvement; sample content wears a dashed badge edge. Depth is almost flat. Lines mark structure, not lists: a one-pixel rule appears only where a fixed region meets scrolling content or where two panes share one container. Rows and sections separate by spacing on a shared grid. The only large soft shadows sit under the two instruments (the editor frame and the graphite recorder).

**Key Characteristics:**
- White editor chrome; one-pixel lines mark scroll edges and pane splits, never rows or sections.
- Five foundation hues, each a pastel field plus a deep ink, shown only where that foundation is active.
- Neutral graphite for dark surfaces; orange glass as the only warm color, lit only while something is live.
- Wide, extra-bold Archivo display type against mono timecodes.
- State by stroke: solid or dashed, filled or open.

## Colors

A near-white canvas and graphite inks, five pastel foundation hues with paired deep inks, neutral graphite for dark surfaces, and orange glass as the only warm color.

### Primary
- **Graphite Ink** (ink): the primary action color. Primary buttons, headline text, the played portion of the waveform, active tab indicator. On hover the primary button lifts toward graphite (ink mixed with 45% graphite).

### Secondary
- **Orange Glass** (glass): the only warm color in the system. Playhead line and handle, playing state of the play button, the record button while live, slider thumb, progress fill, focus ring and outline, `accent-color`. Always rendered with the glass-lit shadow, never as a large flat field of UI chrome.
- **Hot Glass** (glass-hot): glass hover state and the selection tint (mixed 38% into white).
- **Glass Ink** (glass-ink): orange for text and strokes on white: unlit play button glyph, input focus border, caret, the arrow in the try heading.

### Tertiary
- **The Five Foundations**, each a pastel fill for fields and a deep ink for text and strokes:
  - **Rate Sky** (f-rate / f-rate-ink)
  - **Volume Lilac** (f-volume / f-volume-ink)
  - **Pitch Rose** (f-pitch / f-pitch-ink)
  - **Tonality Straw** (f-tonality / f-tonality-ink)
  - **Pauses Mint** (f-pauses / f-pauses-ink)
- **Iridescent Film**: a 100deg linear gradient through the five fills in course order (rate, volume, pitch, tonality, pauses). In the build it appears only on the live input-level bars while recording.

### Neutral
- **Paper** (paper): page background, editor label column, notes rail, card footers.
- **Surface** (surface): pure white for the editor, cards, inputs, outline buttons, the Foundations band.
- **Sunken** (sunken): hover fill, secondary buttons, tab list ground, disabled inputs.
- **Line** (line): the structural line: card borders, scroll edges (scrolled nav, rail summary, phone sheet header), pane splits (editor toolbar, viewer and timeline, label column, notes rail, figure caption, card and dialog footers, tabs line rail), and the ring around a lifted note.
- **Line Strong** (line-strong): input and outline-button borders, editor and dialog frames, the retake timeline line, the separator's midpoint, waveform unplayed stroke, ruler ticks, scrollbar thumb.
- **Ink 2** (ink-2): secondary text, lead paragraphs, nav links.
- **Ink 3** (ink-3): tertiary text, timecodes, captions, placeholders.
- **Graphite** (graphite), **Graphite Deep** (graphite-deep), **Graphite Line** (graphite-line): neutral near-black for the recorder body, the dark Promises band, dark alerts, the progress track on dark, and the dark alert border; Graphite Deep is also the inset panel inside the recorder. Graphite Line is also unlit glass. Chroma stays at or below 0.004: these read as neutral, not brown.
- **Light on Graphite** (on-graphite) and **Muted on Graphite** (on-graphite-muted): headline and body text on graphite grounds, near-neutral (chroma 0.002 to 0.004). The build writes these as inline literals, not CSS variables; they recur and belong in the palette.
- **Destructive** (destructive): errors, used on a 88% white tint rather than as a solid fill.

### Named Rules
**The Active-Only Rule.** A foundation color appears only where that foundation is present in the data: its lane, its swatch, its badge, its note. Never as decoration, section tint, or brand accent.

**The One Warm Light Rule.** Orange glass marks the single live or draggable thing: the playhead, recording, playback in progress, focus. Unlit glass is graphite-line. If two unrelated things are orange, one of them is wrong.

**The No Brown Rule.** Dark surfaces are neutral graphite (chroma 0.004 or less), and nothing dark exceeds the chroma of ink itself (0.008). No brown or walnut surfaces, text or shadows; shadows tint neutral. Orange glass is the only warm color. This is a founder decision recorded in PRODUCT.md.

**The Fill and Ink Rule.** Every foundation hue is a pair: pastel for fields, deep ink for text, strokes and pins. Pastel never carries text by itself; foundation text is always the ink.

## Typography

**Display Font:** Archivo Variable at width 125 (`font-wide`), with ui-sans-serif fallback
**Body Font:** Archivo Variable at width 100
**Label/Mono Font:** Martian Mono Variable, with ui-monospace fallback

**Character:** One variable family stretched two ways: wide and extra-bold for anything that names a thing, normal width for reading. Martian Mono is reserved for time and measurement, so a mono glyph always means "this is a number from the take".

### Hierarchy
- **Display** (800, clamp(2.5rem, 4.5vw, 4.25rem), 0.95, -0.035em, wide): the single page headline; balanced wrapping.
- **Headline** (800, clamp(2rem, 3.8vw, 3.5rem), 0.98, -0.03em, wide): section headings, paired left with a lead paragraph right on large screens.
- **Title** (700, 1.625rem to 1.125rem, tight, -0.02em to -0.01em, wide): foundation names, promise titles, retake steps, recorder prompts.
- **Monitor** (600, 1.875rem desktop / 1.375rem mobile, 1.25, -0.015em, wide): the transcript line in the editor monitor, max 34ch.
- **Body lead** (400, 1.0625rem, 1.625): section intros in ink-2, max 46ch.
- **Body** (400, 0.9375rem, 1.625): list and card copy, max 52ch.
- **Body small** (400, 0.8125rem, 1.55): notes, captions, nav links.
- **Label** (600, 0.75rem to 0.6875rem, sentence case): lane labels, note headers, badge text (500, 0.6875rem).
- **Time** (Martian Mono 400, 0.75rem to 0.5625rem, tabular): timecodes, ruler ticks, lane measurements (wpm, seconds).

### Named Rules
**The Mono Means Measured Rule.** Martian Mono is used only for times and measured values. Words are never set in mono.

**The Sentence-Case Rule.** Labels are small, semibold and sentence case. The build has no uppercase tracked labels.

## Layout

A centered container of 1320px max with gutters of 16px, 24px (sm) and 40px (lg). Sections are full-bleed bands with no divider lines: they separate by 80px (mobile) or 112px (sm and up) of vertical padding and by alternating ground (paper, white surface, graphite). The footer sits on paper with no top rule. Every section heading sits on one shared grid: from 1024px, two columns of minmax(0, 1.35fr) and minmax(0, 1fr) with a 64px gap, heading left and lead paragraph right, bottom-aligned; below that they stack. The Promises band uses the same grid, with its list in the lead column: items stacked title over body (8px), 36px between items.

Content is organized as open lists on the shared grid rather than cards or ruled tables: the foundations list is a four-column grid of rows separated by spacing alone; the promises are a spaced list in the lead column; the retake steps are a single timeline whose line (line-strong) is kept because it is the timeline (vertical on mobile, horizontal from 640px), with the retake step marked by a short glass tick. The retake comparison figure is one container split into a paper caption pane and the takes, with a line at the split. The editor is a full-container-width frame: toolbar, viewer (the monitor), and a timeline with a fixed label column (5.75rem, 8.5rem from sm) and a notes rail (19 to 24rem) on the right from 768px, each pane split by a line. Inside the timeline the words, take and lane rows have no dividers; only the ruler keeps its baseline. Below 768px the rail becomes a phone note pane and an all-notes bar opening a bottom sheet, again split by lines.

The nav is 56px and sticky; after 8px of scroll it turns translucent paper with backdrop blur and gains a one-pixel line bottom border (a scroll edge). At rest the border is transparent. Motion uses one easing, `cubic-bezier(0.16, 1, 0.3, 1)`, at 200ms for controls; the editor lanes reveal once, left to right, 1100ms with 150ms stagger, and are disabled under reduced motion.

## Elevation & Depth

Nearly flat. Structure comes from spacing, tonal steps (paper, surface, sunken, graphite, graphite-deep) and one-pixel structural lines at scroll edges and pane splits. Shadows exist in four roles: a faint contact shadow under controls and cards, a soft lift for the active rail note, the glass glow that makes orange read as lit, and one long soft drop under each instrument (the editor frame and the graphite recorder).

### Shadow Vocabulary
- **Contact** (`box-shadow: 0 1px 2px oklch(0.2 0.01 55 / 0.05)`): cards; 0.08 alpha for active tabs and toggles combined with a line-strong ring.
- **Ink button** (`box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.14), 0 1px 2px oklch(0.2 0.01 55 / 0.3)`): primary and graphite buttons.
- **Scroll cue** (`box-shadow: inset 0 10px 10px -10px oklch(0.2 0.01 55 / 0.25)`): the top of the rail's note list once it has scrolled, under the summary's scroll-edge line.
- **Note lift** (`box-shadow: 0 0 0 1px var(--line), 0 4px 14px -8px oklch(0.2 0.005 60 / 0.25)`): the active note in the rail, a white block raised off paper.
- **Glass lit** (`box-shadow: 0 1px 2px oklch(0.3 0.005 60 / 0.25), 0 8px 20px -10px oklch(0.55 0.17 45 / 0.7)`): any lit orange glass.
- **Instrument** (`box-shadow: 0 1px 2px oklch(0.2 0.01 55 / 0.06), 0 30px 80px -40px oklch(0.25 0.005 60 / 0.35)`): the editor frame. The recorder uses a deeper neutral variant. Only the glass glow's outer layer carries orange hue.
- **Focus** (`box-shadow: 0 0 0 3px color-mix(in oklch, var(--glass) 22%, transparent)`): input focus halo.

### Named Rules
**The Lines Mark Structure, Not Lists Rule.** A one-pixel line rule is used in exactly two cases. Scroll edge: a fixed region sits over content that scrolls (the scrolled nav's bottom border, the rail summary above the note list, the phone notes sheet header). Pane split: two panes share one container (editor toolbar and viewer, viewer and timeline, label column, notes rail, figure caption and takes, card and dialog footers, phone note pane and all-notes bar, the tabs line rail the active indicator rides on). Rows and section breaks get no line: foundation rows, lanes, rail notes, promises, accordion items, the "Listening for" list and page sections separate by spacing and sit on the shared grid. Data lines are exempt (ruler baseline, retake timeline, waveform, leaders).

**The Fading Separator Rule.** A free-standing separator, outside any container, fades to transparent at both ends (line-strong at its midpoint).

## Shapes

Small, square-shouldered corners. The base radius is 6px (lg) for frames and cards, about 4.8px (md) for buttons and inputs, 3px for badges, swatches and lane tiles, 2px for data bars inside lanes. The graphite recorder body is the one softer container at about 9.6px. Round shapes are functional only: the play button, the record glass, the playhead line, pins and scrollbar thumbs. Badges are never pills.

## Components

### Buttons
Tactile and precise, like hardware keys.
- **Shape:** gently squared (md, about 4.8px); xs sizes use 3px.
- **Primary:** graphite ink on paper text, 36px tall, 14px horizontal padding, 14px text, weight 500, inset top highlight. Hover lifts toward graphite.
- **Hover / Focus:** 200ms on the house easing; 2px glass focus ring offset 2px on paper; pressed state nudges down 1px; disabled at 45% opacity.
- **Outline / Secondary / Ghost:** white with line-strong border (hover to ink-3 and sunken); sunken fill; ink-2 text with sunken hover.
- **Glass:** lit orange with ink text, for recording and live playback only. **Glass off:** white with glass-ink glyph, the resting play control. **Graphite:** the recorder's body color as a button.
- **Sizes:** xs 24px, sm 32px, default 36px, lg 44px; icon squares to match.

### Badges
- **Style:** 20px tall, 3px radius, 11px medium text, 6px padding.
- **Foundation variants:** pastel fill with the matching deep ink text.
- **Sample:** dashed line-strong border on white with ink-3 text; all sample content is labeled with it.
- **Live:** lit glass.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** surface; the footer is a paper pane split from the body by a one-pixel line (dialog footers match).
- **Shadow Strategy:** contact shadow only.
- **Border:** one-pixel line.
- **Internal Padding:** 20px (12px small).

### Inputs / Fields
- **Style:** 40px, white, line-strong border, 6px-ish (md) radius, faint inset shadow, ink-3 placeholder.
- **Focus:** border turns glass-ink with a 3px glass halo at 22%.
- **Error / Disabled:** destructive border with a 16% halo; disabled goes sunken with ink-3 text.

### Navigation
Wordmark (placeholder mic-with-mane mark plus wide extra-bold "MicMane"), three 13px medium ink-2 links that go ink on hover, a small primary button right. When scrolled, a one-pixel line bottom border marks the scroll edge; no shadow. Below 768px, links move into a right sheet as spaced rows (no dividers) with a full-width large primary button.

### Tabs, Toggles and Accordion
Accordion items have no dividers; they separate by spacing.

Tab lists sit on sunken with an inset line; the active tab is white with a line-strong ring. The line variant sits on a one-pixel line rail, and the active tab's one-pixel ink indicator rides on it. Layer toggles keep the label in ink and let a 10px foundation swatch carry color, at 30% opacity when off.

### Slider / Scrubber
A one-pixel line-strong track with an ink range and a 10 by 20px lit-glass thumb at 3px radius: the playhead handle in miniature.

### The Editor (signature)
The product's core instrument. Toolbar (round play button, mono timecode, title, sample badge, primary action), monitor (current transcript line with active words highlighted in the note's foundation fill), a ruler with 1s and 5s ticks, caption track, a waveform stroked ink where played and line-strong ahead, then five 46px foundation lanes. The toolbar, viewer and timeline are panes split by lines; the rows between ruler and lanes have no dividers. A 2px glass playhead with a white hairline spans all tracks. Notes are pins in the foundation ink: filled for strengths, open ring for improvements, dashed stroke and dashed leader when tentative. Rail notes are rounded blocks on paper; the active note lifts as a white block with a line ring and the note-lift shadow.

### The Recorder (signature)
A graphite slab with a large circular glass button (144px, 176px from sm): unlit graphite-line at rest, lit glass while recording. Live input level runs as thin bars in the iridescent film only while recording; foundation swatches light in sequence while the review runs, in a rounded graphite-deep "Listening for" panel whose rows separate by spacing only.

## Do's and Don'ts

### Do:
- **Do** keep the canvas paper, surface and graphite; let color enter only through an active foundation or live glass.
- **Do** pair every foundation fill with its ink, and set foundation text in the ink.
- **Do** separate rows and sections by spacing on the shared heading/lead grid (lg: minmax(0, 1.35fr) and minmax(0, 1fr), 64px gap).
- **Do** draw a one-pixel line where a fixed region meets scrolling content, or where two panes share one container.
- **Do** express state by stroke: solid for clear, dashed for tentative or sample, filled for strength, open ring for improvement.
- **Do** set times and measured values in Martian Mono with tabular figures.
- **Do** use the glass focus ring (2px, offset 2px) on every interactive element.

### Don't:
- **Don't** use a foundation hue for decoration, section backgrounds, or emphasis unrelated to that foundation.
- **Don't** light glass when nothing is live, or use it for a second, unrelated highlight on the same screen.
- **Don't** round badges, tags or lane tiles into pills; keep them at 3px or less.
- **Don't** put large drop shadows on anything other than the editor frame and the recorder.
- **Don't** set words or labels in mono, or in uppercase with tracking.
- **Don't** draw lines between list rows, lanes, notes, accordion items or page sections.
- **Don't** use the iridescent film as a background, border or button fill.
- **Don't** use brown or walnut tones for surfaces, text or shadows; dark means neutral graphite.
