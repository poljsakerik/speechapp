---
name: MicMane
description: Each lesson unfolds like the liner booklet of an album from a Night City label.
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
    fontSize: "clamp(2.5rem, 5vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.035em"
    fontVariation: '"wdth" 125'
  headline:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.4vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.03em"
    fontVariation: '"wdth" 125'
  cover-title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: '"wdth" 125'
  lyric:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 2.1vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
    fontVariation: '"wdth" 125'
  lyric-tape:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.9vw, 1.75rem)"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.015em"
    fontVariation: '"wdth" 125'
  page-title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2.4vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontVariation: '"wdth" 125'
  title:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2.5rem"
    letterSpacing: "-0.02em"
    fontVariation: '"wdth" 125'
  title-sm:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    letterSpacing: "-0.01em"
    fontVariation: '"wdth" 125'
  body-lead:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: "1.75rem"
  body:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    fontVariation: '"wdth" 100'
  body-sm:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Archivo Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1.25rem"
  time:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    fontFeature: '"tnum"'
  measure:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    fontFeature: '"tnum"'
  track-number:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    fontFeature: '"tnum"'
  catalog:
    fontFamily: "Martian Mono Variable, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    fontFeature: '"tnum"'
rounded:
  hair: "2px"
  tick: "3px"
  lane: "4px"
  md: "4.8px"
  slot: "8px"
  booklet: "10px"
  full: "9999px"
spacing:
  half: "4px"
  unit: "8px"
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
  timecode-gutter: "72px"
  page-pad: "32px"
  list-gap: "40px"
  spread-gap: "48px"
  spread-gap-wide: "64px"
  section: "96px"
  section-wide: "144px"
  container: "1440px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-lg:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
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
  badge-sample:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.tick}"
    padding: "0 6px"
    height: "20px"
  badge-foundation-volume:
    backgroundColor: "{colors.f-volume}"
    textColor: "{colors.f-volume-ink}"
    rounded: "{rounded.tick}"
    padding: "0 6px"
    height: "20px"
  booklet-page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.booklet}"
    padding: "{spacing.page-pad}"
  album-cover:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.on-graphite}"
    rounded: "{rounded.booklet}"
    padding: "24px"
  lane-well:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lane}"
    height: "46px"
  recorder-lane:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lane}"
    height: "56px"
  transport:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.on-graphite}"
    padding: "12px 0"
  transport-play:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.graphite-deep}"
    rounded: "{rounded.full}"
    size: "40px"
  transport-play-hover:
    backgroundColor: "{colors.glass-hot}"
  button-on-graphite:
    backgroundColor: "{colors.on-graphite}"
    textColor: "{colors.graphite-deep}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  foundation-lane:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.hair}"
    height: "10px"
  take-slot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.slot}"
    padding: "20px"
  note-quote-rate:
    backgroundColor: "{colors.f-rate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hair}"
    padding: "0 4px"
  notes-switch-chip:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.tick}"
    padding: "0 10px"
    height: "32px"
  notes-switch-chip-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
---

# Design System: MicMane

## Overview

**Creative North Star: "The Liner Booklet"**

Each lesson unfolds like the liner booklet of an album from a Night City label. The take is the track, its transcript is the lyric sheet, and the review is written under its lines. Every section is a booklet spread: graphite album covers and titles on the left, white pages of reading on the right. The cover is not an illustration; it is drawn from the take itself: one ridge for each spoken line that showed a strength, raised by that line's recorded level and filled with the foundation of that strength. Ridges stack up from the bottom, so a take with few strengths is a low stack and covers fill up as you practise. The one exception is the promotional sleeve, which shows every foundation at once.

The notebook is an undertone, not the personality, and it lives in structure only: notes written under the line they are about, one endless page per take, and the 8px rhythm. It has no material of its own; booklet pages are plain white, and dotted surfaces read cheap rather than chic. Everything else is the label's: wide extra-bold Archivo that names things, Martian Mono for timecodes, measurements, catalog numbers and track numbers, neutral graphite sleeves, and orange glass as the one warm light. Color is rationed. Foundation hues appear only where a foundation is in the data, laid on words as multiplied highlighter and on ridges as fill. Small orange details tie the pages together: glass marks every play control and whatever is happening now.

The voice sells the outcome, not the instrument: unlocking your voice, confidence, potential, learning and getting better. Covers are brand texture and are never named as a feature in copy. The first view stays sparse, so nothing competes with listening to the example.

The page has one rhythm. A single twelve-column spread runs top to bottom; sections separate by space and by ground (paper, white surface, graphite), never by rules. One shared playhead drives everything that follows a take: the lyric sheet fills in word by word, the cover's other ridges dim while a glass bead rides the current crest, and a glass hairline tracks progress.

Where the landing reads a take as a lyric sheet, the review reads it line by line under its timeline. The review is one long white booklet page under a sticky graphite transport whose scrubber is the take's only timeline: the glass playhead runs along the top and the notes sit on the bar as foundation slices. On the page, each spoken line sits beside its timecode, silences open real space, and every note is listed under the line it is about. One note is in focus at a time: it alone is open, quoting its words in its own highlighter, and its words alone are coloured in the line. The recorder is a horizontal tape: one minute, left to right, filling with your level as you speak. Covers do not appear on the upload and review screens.

**Key Characteristics:**

- Booklet spreads on a 12-column grid: covers and titles in the left five columns (sticky on large screens), reading in the right seven.
- Album covers drawn from the take: graphite ground, one filled ridge per line that showed a strength, stacked from the bottom and clipped at a horizon, title on clean graphite below; covers fill up as you practise.
- Plain white booklet pages with a 10px corner; the notebook lives in structure (notes under their line, one endless page per take, the 8px rhythm), never in a printed texture.
- Foundation fills as multiplied highlighter on words, one colour at a time on the review (the note in focus, or the one foundation in view); pins filled or open, solid or dashed.
- Orange glass for play controls and whatever is live: the play buttons, the current word, the bead, the playheads, recording, the section you are in.
- Wide Archivo names things; Martian Mono numbers them.
- One timeline per take: the transport scrubber with foundation note slices and a glass playhead, which the review page follows.
- The recorder tape: one minute left to right, the recorded level as a mirrored ink area.
- Foundations the review did not assess are drawn dashed, never filled.

## Colors

A near-white canvas and graphite inks, five pastel foundation pairs, neutral graphite sleeves, and orange glass as the only warm color.

### Primary

- **Graphite Ink** (ink): the primary action and the reading voice. Primary buttons, headlines, spoken words on the lyric sheet, the "next take" line. On hover the primary button lifts toward graphite (ink mixed with 45% graphite).

### Secondary

- **Orange Glass** (glass): the one warm light, for play controls and what is live. Play controls, at rest and while playing: the hero cover's round play button, the review transport's play button, the recorder's round play button, the filled play icon in "See an example", and the small play triangles on notes and suggestion buttons. Live state: the current word's 3px underline, the bead riding the cover's current crest (with a 28% halo), the 2px progress hairline over the sheet's line, the nav tick under the section in view, the scrubber's playhead while playing, the recorder's head while recording or playing, the `tape-scan` head while the coach listens, the "Stop recording" button, the drop-target ring, focus rings and `accent-color`.
- **Hot Glass** (glass-hot): glass hover and the selection tint (mixed 38% into white).
- **Glass Ink** (glass-ink): orange for text on white: the running timecode while playing, the current line's timecode, timecode and play-control hover, the "The coach is listening for" label while the coach listens, the caret.

### Tertiary

- **The Five Foundations**, each a pastel fill for fields and a deep ink for text, strokes and pins:
  - **Rate Sky** (f-rate / f-rate-ink)
  - **Volume Lilac** (f-volume / f-volume-ink)
  - **Pitch Rose** (f-pitch / f-pitch-ink)
  - **Tonality Straw** (f-tonality / f-tonality-ink)
  - **Pauses Mint** (f-pauses / f-pauses-ink)

  Fills appear as cover ridges, as the highlighter band behind noted words (`mix-blend-mode: multiply`; 14% to 92% of the line box on the lyric sheet, 10% to 92% on the review page, for the note in focus; with one foundation in view, its other noted words carry the fill at 50% as a wash), as the chip behind the words a review note quotes (laid on plain, not multiplied), as note slices on the transport scrubber and the foundation lanes, as lane signals, as the retake curve area, and as 10px swatches outlined in their own ink. Inks also fill measured pauses that a pauses note is about, the dashed box where a pause belongs, and the underline under a suggested phrase.

### Neutral

- **Paper** (paper): page ground, footer, lane wells.
- **Surface** (surface): white booklet pages, the Lessons band, outline buttons, badges.
- **Sunken** (sunken): button hover fills, secondary buttons, and the track of a foundation lane.
- **Line** (line): the one-pixel ring around pages, lane wells and the recorder lane, the progress track, the scrolled nav's bottom edge.
- **Line Strong** (line-strong): the retake spine and its open nodes, the dashed empty slot ("Take 3 is yours"), the dashed sample badge, the pause leader between lines, unnoted pause marks, outline-button borders, the 12px dash before a silence's "x.x s" leader, the bare one-pixel hairline along the unrecorded remainder of the recorder tape, the dashed swatch of a foundation not reviewed, the 2px underline under noted phrases on the review that are not coloured, the ring of the review's notes-switch chips, and the empty swatch of a foundation with no notes.
- **Ink 2** (ink-2): lead paragraphs, note observations, footer text, nav links.
- **Ink 3** (ink-3): captions, timecodes at rest, the duration inside "See an example", track numbers, measure lines, the words of the current review line not yet spoken, a foundation's "not judged" reason.
- **Graphite** (graphite): album covers, the Promises band, the sticky transport strip, and the 5px stroke that separates stacked ridges on a cover. **Graphite Line** (graphite-line): the dashed ridge outlines of the unpressed sleeve; on the transport, the scrubber track and the pressed fill of a speed or Follow control. **Graphite Deep** (graphite-deep): icon and text color on controls that sit on graphite (the transport's glass play button, "Another take").
- **Light on Graphite** (on-graphite) and **Muted on Graphite** (on-graphite-muted): titles and secondary text on covers and the Promises band; muted also sets the cover's catalog number and its mono take line, the transport's total time, the played part of the scrubber, and resting transport controls. Light on graphite is also the scrubber's playhead while paused.
- **Destructive** (destructive): errors, on an 88% white tint, never as a solid fill.

### Named Rules

**The Active-Only Rule.** A foundation color appears only where that foundation is present in the data: a ridge whose line showed it as its first strength, a highlighted word, a lane, a pin, a swatch. Never as section tint or brand accent. The single exception is a promotional cover (the hero sleeve): the take is cut into five even slices, one per foundation fill in course order, every ridge filled. No other surface borrows the five fills as decoration.

**The One Warm Light Rule.** Orange glass marks two things only: play controls, and whatever is live. Play controls are glass at rest as well as while playing, as small orange details that tie the pages together. Live means the playhead and everything it drives (the current word, the cover's bead, the progress hairline), recording, and the section in view. When nothing plays, the cover shows no bead and the sheet shows no underline. No orange on anything else.

**The Not Judged Rule.** All five foundations are reviewed, but a foundation the review returns as uncertain (not enough evidence on this take) is drawn with a dashed line-strong swatch, its name in ink-3, and the backend's own reason ("There is not enough clear speech to judge volume in this take."), falling back to "Not enough evidence to judge on this take"; it gets no verdict, no lane and no fill. Only judged foundations carry their pair. Not judged must never read as passed.

**The No Brown Rule.** Dark surfaces are neutral graphite (chroma 0.004 or less), and nothing dark exceeds the chroma of ink itself (0.008). No brown or walnut surfaces, text or shadows; shadows tint neutral. Orange glass is the only warm color. This is a founder decision recorded in PRODUCT.md.

**The Fill and Ink Rule.** Every foundation hue is a pair: pastel for fields, deep ink for text, strokes and pins. Pastel never carries text by itself; foundation text is always the ink.

**The One Colour at a Time Rule.** On the review, a word never carries more than one foundation colour (founder decision, 2026-10-03: one stripe per overlapping note, with "continues from" markers, could not be read). With all notes in view, every noted phrase carries the same quiet 2px line-strong underline, whatever foundation it is about, and only the note in focus (being played, picked or stepped to; hovering a note previews it) is coloured: its words take that foundation's full highlighter band on every line it covers. With one foundation in view, that foundation's noted words carry its fill at 50% as a wash, and the note in focus takes the full fill. Suggested-phrase underlines, the dashed "a pause belongs here" box and the pauses-ink pause bar show only for notes that are coloured. Overlap is resolved by the notes switch and by focus, never by layering colours.

## Typography

**Display Font:** Archivo Variable at width 125 (`font-wide`), with ui-sans-serif fallback
**Body Font:** Archivo Variable at width 100
**Label/Mono Font:** Martian Mono Variable, with ui-monospace fallback

**Character:** One variable family stretched two ways: wide and extra-bold for anything that names a thing (headlines, cover titles, lesson names, the lyric lines themselves), normal width for reading. Martian Mono is the label's numbering: timecodes, measurements, catalog numbers, track numbers.

### Hierarchy

- **Display** (800, clamp(2.5rem, 5vw, 4.5rem), 0.95, -0.035em, wide): the single page headline; balanced wrapping.
- **Headline** (800, clamp(2rem, 3.4vw, 3.25rem), 0.98, -0.03em, wide): section titles in the left columns.
- **Cover title** (800, clamp(1.75rem, 3vw, 2.5rem), 1, -0.03em, wide): the take's name on clean graphite below the horizon; the "MicMane" label mark above it at 0.9375rem.
- **Lyric** (600, clamp(1.375rem, 2.1vw, 1.875rem), 1.3, -0.015em, wide): each spoken line on the lyric sheet, max 34ch.
- **Lyric on tape** (600, clamp(1.25rem, 1.9vw, 1.75rem), 1.4, -0.015em, wide): each spoken line on the review page, max 40ch; slightly smaller than the lyric sheet's, on a taller line.
- **Page title** (700, clamp(1.5rem, 2.4vw, 2rem), 1.15, -0.02em, wide): the state heading inside the recorder page ("Press record and talk.", "Your take", "Listening to your take…").
- **Title** (700, 1.5rem on a 2.5rem line, -0.02em, wide): lesson names in the track list. **Title small** (700, 1.125rem to 1rem, -0.01em): page headers and take labels; the "next take" line runs at 1.25rem.
- **Body lead** (400, 1.0625rem on 1.75rem): section leads in ink-2, max 46ch; also the review's message when a take has no notes.
- **Body** (400, 0.9375rem on 1.5rem): lesson descriptions, the overall note, showcase spread notes and recorder copy, max 52ch. At medium weight (500) it sets a note's observation in the review.
- **Body small** (400, 0.8125rem on 1.25rem): note observations on the lyric sheet, a review note's why and practice line, captions, nav links. At semibold (600) in ink it sets the words a review note quotes. On a 24px line it sets a review note's one-line entry (the foundation's short name semibold in its ink) and, at medium weight (500), the notes-switch chips.
- **Label** (600, 0.75rem on 1.25rem, sentence case): note foundation names on the lyric sheet, verdict tags, the "Overall" row label, the "The coach listens for" list heading. Foundation names in the review's foundation rows and the recorder's list step up to 0.875rem semibold.
- **Time** (Martian Mono 400, 0.75rem, tabular): line timecodes, the running time, take facts under a headline ("0:15 · 7 lines · 4 notes"). A note's play time, the notes switch's counts and the speed steps run at 0.6875rem. While recording, the elapsed time is set large in light mono (300, clamp(2.5rem, 5vw, 3.5rem)).
- **Measure** (Martian Mono 400, 0.625rem, tabular): the silence between lines ("0.7 s") and the recorder tape's ticks.
- **Track number** (Martian Mono 400, 0.875rem on 1.5rem, tabular): two-digit lesson numbers, 01 to 05.
- **Catalog** (Martian Mono 400, 0.6875rem, tabular): release numbers on covers and in the footer (MMV 001).

### Named Rules

**The Mono Numbers Rule.** Martian Mono sets numbers that belong to the take or the label: timecodes, measured values, catalog numbers, track numbers. Words are never set in mono; a unit that belongs to a number ("s", "×") travels with it, but counted nouns do not ("4 notes" sets only the 4 in mono).

**The Sentence-Case Rule.** Labels are small, semibold and sentence case. The build has no uppercase tracked labels and no eyebrows above headings.

**The 4px Leading Rule.** Line heights for text that sits beside other rows land on whole 4px steps (20, 24, 28, 40px), so text rows sit on the page's cadence.

## Layout

A centered container of 1440px max (page sections, nav and footer alike), gutters 16px, 24px (sm) and 40px (lg). Every section is one booklet spread: a grid with a 48px gap (rows and columns), twelve columns from 1024px with the column gap widening to 64px, left five columns for the cover or the section title, right seven (starting at column six) for the reading. On large screens the left column is sticky (top 80px for the hero cover, 96px for section titles), so the title stays with its reading as you scroll. Below 1024px the spread stacks: in the hero, headline and actions first, then the cover, then the lyric sheet. The hero opens closer to the nav than other sections (top padding 48px, 64px from sm, 80px from lg).

Sections are full-bleed bands with no divider lines. They separate by vertical padding (96px, 144px from lg) and alternating ground: paper, white surface, paper, graphite, paper. The footer sits on paper with no top rule.

Spacing runs on an 8px cadence at layout level: spread gap 48/64px, section padding 96/144px, list gap 40px, page padding 32px (16px on mobile; 48px across and 40px down on the hero's lyric-sheet page from 1280px). Inside components a 4px half-step is allowed (12px and 20px insets). The lyric sheet turns silence into space: the gap after a line is a multiple of 8px that grows with the pause (8 × round(2 + seconds × 4)), with the seconds printed in mono when the pause is at least 0.25s.

Inside the reading column, rows use a fixed label gutter: the lyric sheet and the overall note use a 4.5rem timecode column with a 24px gap; the lesson track list uses a 2.5rem (3rem from sm) number column. On the lyric sheet, notes sit under their line in the text column, two across from 768px.

**The take workspace.** Neither upload nor review carries the site nav. The upload page opens with a 56px header holding only the wordmark; the review opens on the sticky transport. Upload is a spread centred vertically in the viewport (founder decision, 2026-10-03): the display headline "Record a take." and a lead at the top of the left five columns, "The coach listens for" list at their bottom, and the recorder booklet page in the right seven (the horizontal tape at its top, the state content 40px below). The left column is exactly as tall as the card: the headline sits on the card's top edge and the list on its bottom edge. From lg the headline is trimmed to its capitals and the last foundation name to its baseline (`text-box` trim, where the browser supports it), so the letters, not their line boxes, meet the card's top and bottom edges. The card's padding is the same on all four sides (16px, 32px from sm, 48px from xl); when the left column is the taller one, the card stretches and its content centres so top and bottom stay equal. On phones the recorder page comes straight after the headline. No fine print: file type and size limits appear as validation feedback the moment a file is chosen. The review opens with a spread (left: the headline "Notes on your take" and the mono take facts, nothing else; no lead paragraph and no keyboard hint, though Space, J and K still work; only a take with no notes at all adds the empty-review message in body lead; right: the five foundation rows, 20px apart), then the review page 48px down (64px from lg), full container width (padding 32px down and 12px across on phones, 40px by 32px from sm, 48px across from xl). When the take has notes, the page opens with the notes switch, 40px above the first line.

Every review row shares one grid: on phones a single column, the timecode above the line; from sm timecode and line (4.5rem and the rest, 24px gap, 40px from lg). There is no margin column: a line's notes sit in its own column, 16px under the line, as one list of one-line entries 4px apart (max 38rem). There is no ribbon or second timeline on the page; the transport scrubber is the take's only timeline. Silence rows between lines are 8 × round(2 + min(s, 4) × 6) px tall, so the review opens more space for longer pauses than the lyric sheet does, and carry a mono "x.x s" leader after a 12px line-strong dash from 0.25s (hidden on phones).

**The Under the Line Rule.** A review note sits under the line it is about, never in a side column (founder decision, 2026-10-03: notes on the right were hard to connect with the words; below the text, as on the landing lyric sheet, is preferred). Under each line is a list of one-line entries, one for every note about words on that line, including a note that began on an earlier line (its entry says "from an earlier line"; its start time is the mono time on the right). Only the note in focus is open: it adds the words it is about, quoted in its own foundation fill so note and text can be matched by eye, then the observation, the why, the practice line and the suggestions. A note opens on the line it was picked on, otherwise on the line it begins on. A line's row holds its words and its notes; silence stays its own row, so the room notes take is never read as time.

**Follow the playhead.** While playing, the page eases so the playhead holds at 42% of the viewport height (each frame closes 12% of the distance); a wheel, a touch drag, or PageUp/PageDown/Home/End/arrow keys outside the scrubber release it, and the Follow control or pressing play restores it. Under reduced motion the page jumps line by line instead of easing.

**The specimen book.** /components sets every section as a spread: the title (title type) and a one-sentence note in body ink-2 (max 44ch), sticky at 96px on large screens, left; the specimen on a booklet page right (24px down and 16px across on phones, 32px from sm). Sections are 96px apart (144px from lg). The header spread holds the display headline left and a lead with a two- or three-column section index right.

The nav is 56px and sticky. It lights the section in view (the one under a reading line at 35% of the viewport) with ink text and a 2px glass tick beneath. Adaptation note: the direction contract asked for a stage log; the build lights section names (The example, Lessons, The retake, Promises) instead, because the page opens on a reviewed example rather than running in loop order and the promises band is not a stage, so stage names would mislabel the anchors.

Motion uses one easing, `cubic-bezier(0.16, 1, 0.3, 1)`, at 200ms for controls. Cover ridges (each one group) rise once on load from their baseline (1100ms, staggered 140ms after a 180ms start); a playing take dims non-current ridges over 500ms and colors spoken words over 150ms; an unpressed sleeve's dashed ridge outlines drift (3.6s linear loop). Ridge-rise and drift are off under reduced motion. In the review, words of the current line move from ink-3 to ink over 150ms; a noted phrase switches at once between its quiet underline and the band of the note in focus; scrubber note slices sit at 45% opacity and rise to full over 200ms for the note in focus. The recorder's `tape-scan` head sweeps the recorded length left to right and back (2.4s, `cubic-bezier(0.65, 0, 0.35, 1)`, alternating) while the coach listens; it rests at the start under reduced motion.

## Elevation & Depth

Nearly flat, with the depth of printed objects on a table. Structure comes from ground changes and the one-pixel ring around each page. Shadows exist in four roles: the long soft drop of a sleeve under each album cover, a softer lift under white booklet pages, the ink button's contact, and the glass glow that makes orange read as lit.

### Shadow Vocabulary

- **Sleeve** (`box-shadow: 0 1px 2px oklch(0.2 0.005 60 / 0.12), 0 36px 70px -36px oklch(0.2 0.005 60 / 0.55)`): album covers only.
- **Booklet page** (`box-shadow: 0 0 0 1px var(--line), 0 1px 2px oklch(0.2 0.01 55 / 0.05), 0 24px 60px -36px oklch(0.25 0.005 60 / 0.3)`): white pages that hold the lyric sheet, the lesson page, the review, the recorder and every showcase specimen; the first layer is the page's edge. Shipped as the shared `booklet-page` utility together with the page's 10px radius and white ground, nothing else.
- **Well** (`box-shadow: inset 0 0 0 1px var(--line)`): lane strips in the track list and the recorder tape's lane.
- **Ink button** (`box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.14), 0 1px 2px oklch(0.2 0.01 55 / 0.3)`): primary and graphite buttons.
- **Glass lit** (`box-shadow: 0 1px 2px oklch(0.3 0.005 60 / 0.25), 0 8px 20px -10px oklch(0.55 0.17 45 / 0.7)`): any orange glass surface, including play buttons at rest. Only this outer layer carries orange hue.

### Named Rules

**The Lines Are Edges or Data Rule.** A one-pixel line is either the edge of an object (a page's ring, a lane well, the scrolled nav's bottom border) or a piece of data (the progress track, the retake spine, the pause leader, a dashed empty slot, the scrubber track, the silence leader's dash, the recorder tape's bare remainder). Rows, notes, list items and page sections never get a divider; they separate by space on the grid.

**The Two Drops Rule.** Large soft shadows belong to covers (sleeve) and booklet pages. Nothing else on the page lifts. The sticky transport is flat graphite with no shadow or rule.

## Shapes

Square-shouldered and small. Covers and booklet pages share a 10px corner, the one softer radius in the system. The empty take slot is 8px; lane wells 4px; buttons and inputs about 4.8px; badges and the review's notes-switch chips 3px; the 10px foundation swatches, foundation lanes, note slices, data bars, the dashed pause box and pause marks 2px; highlighter runs about 0.14em on the tape (0.18em on the lyric sheet). Round shapes are functional only: the cover's play button, the transport's play button, the recorder's play button, pins, the cover's glass bead, the retake spine's nodes, the nav tick's caps, the ends of playheads and the scrubber track. Badges are never pills.

Covers are square (1:1) and clip their ridges at a hard horizon (452 of 600 units), leaving the lower quarter clean graphite for the title. Ridges are smoothed, tapered at both ends to their baseline, and separated by a 5px graphite stroke so stacked lines read as distinct forms.

The recorder's level is mirrored about the lane's center line: a 4-unit core plus up to 40 units each side of a 100-unit field, each point the average of its stretch of tape (about 0.8 points per percent of the minute), so it reads as a smooth ink area rather than a meter.

## Components

### Buttons

Tactile and precise, like hardware keys.

- **Shape:** gently squared (md, about 4.8px); xs sizes use 3px; round play controls are circles (44px on the cover and the recorder, 40px on the transport).
- **Primary:** ink with paper text, 36px tall (44px large, 20px padding), 14px medium text, inset top highlight. "Try a free review" is always primary.
- **Hover / Focus:** 200ms on the house easing; 2px glass focus ring offset 2px on paper; pressed nudges down 1px; disabled at 45% opacity.
- **Outline / Secondary / Ghost:** white with line-strong border (hover to ink-3 and sunken), used for "See an example", which leads with a filled glass play icon, carries its duration in mono ink-3 after the label (0:15), scrolls the lyric sheet into view and plays, and reads "Pause the example" with a glass-ink pause icon while playing; sunken fill; ink-2 text with sunken hover.
- **Glass:** lit orange with ink text and glass-hot hover, for play controls and recording only: "Stop recording", and the round play buttons, which are glass at rest as well as while playing (the hero cover's, the recorder's, the transport's).
- **On graphite:** light-on-graphite fill with graphite-deep text, hover to white, for controls on the transport ("Another take", sm 32px; icon-only on phones).
- **Graphite:** the sleeve's color as a button.
- **Sizes:** xs 24px, sm 32px, default 36px, lg 44px; icon squares to match.

### Badges

- **Style:** 20px tall, 3px radius, 11px medium text, 6px padding.
- **Sample:** dashed line-strong border on white with ink-3 text, for an illustrated item that is not a real measurement (the retake panel's "Illustration"). It is not used in the first view.
- **Foundation variants:** pastel fill with the matching deep ink text. **Live:** lit glass.

### Booklet Page

- **Corner Style:** 10px.
- **Background:** plain white surface; no texture.
- **Shadow Strategy:** booklet page shadow (ring plus soft lift).
- **Internal Padding:** 32px (24px vertical, 16px horizontal on mobile); the hero's lyric-sheet page opens to 48px across and 40px down from 1280px.
- A page opens with a header row (wide title, mono timecode pushed right), then the content. Captions sit outside the page below it, 16px down, in body small ink-3.
- Shared as the `booklet-page` utility (10px radius, white, page shadow); padding is set per use.

### Album Cover (signature)

A square graphite sleeve, drawn from the take. Only a line that showed a strength gets a ridge: its height from the line's smoothed recorded level, filled with the foundation of the line's first strength, separated from its neighbours by a 5px graphite stroke. Lines without a strength draw nothing: no dashed crest, no outline. Ridges stack up from the bottom in line order, each on the slot it would hold on a full cover (slots spaced evenly from 168 to 392 units across every spoken line), so a take with few strengths is a low stack that does not reach the top, and covers fill up as practice adds strengths. Ridges lift by 128 × min(1, 4 / lines) units at full level so many-line takes stay inside the frame, clip at the horizon, and rise once on load, each ridge one group. Top row: the "MicMane" label mark left, mono catalog number right. Bottom: the cover title with a mono take line in on-graphite-muted ("Take 1 · 0:15"), and the round play button. No caption sits under a cover. While a line with a ridge plays, the other ridges dim to 0.42 and a 7.5-unit glass bead with a 28% halo rides its crest. The round play button is glass (44px). The sleeve shadow sits under it.

**Promotional sleeve:** given a palette, the cover cuts the take into one even slice per colour and fills every ridge; the hero uses the five foundation fills in course order (rate, volume, pitch, tonality, pauses), so it always shows the full stack.

**Unpressed sleeve:** the visitor's own cover before recording: the same sleeve with four dashed graphite-line ridge outlines (3px, 8/10 dash) drifting slowly, a next catalog number (MMV 002), "Your take" as the title and "Thirty seconds is enough to start." beneath it in body small on-graphite-muted.

### Lyric Sheet (signature)

Each spoken line is a row: a mono timecode button in the 4.5rem gutter (ink-3, glass-ink while that line plays or on hover; pressing it plays from there) and the line in lyric type. Words a note covers carry the foundation fill as a highlighter band, multiplied; a second note on the same word adds a 2px underline in its ink, dashed when tentative. While playing, words not yet spoken wait at 35% ink and fill in as they are said; the current word gets a 3px glass underline. Pauses inside a line show as a short bar (1.6em per second) in line-strong, or pauses mint outlined in its ink when a pauses note is about them (its time within 0.4s of the pause, or its span covering it). Notes sit beneath: a 12px pin centred on the note's 20px label line, the foundation's short name in its ink, the rule's label ("Rushed passage", "Pause too long"; "Strength" or "To improve" for a rule without one, plus "tentative") in ink-3, the observation in body small ink-2, and for improvements a practice line in ink after a corner-down-right arrow in the foundation ink. The active note's pin gains a faint ring and its text goes to ink.

### Transport (review)

A sticky graphite strip at the top of the review with 12px vertical padding, on the container grid. It holds the take's only timeline. In order: a 40px round play button (lit glass with a graphite-deep icon at rest and while playing, glass-hot on hover; pressed scales to 95%); the mono time (current in on-graphite, " / total" in on-graphite-muted); the scrubber, a 32px-tall slider with a 2px graphite-line track, the played part in on-graphite-muted, one 20px note slice per note in view in its foundation fill (2px corners, 45% opacity, full for the note in focus; pressing one plays that note), and a 2px playhead (glass while playing, on-graphite when paused, absent until first played); the speed group (0.75×, 1×, 1.25×, 1.5× in 0.6875rem mono, the current one on a graphite-line fill); the note stepper, chevrons around "4 notes" at rest or "2 of 4" when a note is in focus (counting the notes in view; numbers in mono, the current one in on-graphite); the Follow control (locate icon, reading "Following" in muted text while the page follows, and "Follow" on a graphite-line fill once released); and the action. On phones the speed, stepper and Follow controls drop to a second row, Follow and the action become icons, and touch targets grow to 32px. Space plays and pauses, J and K step notes, arrow keys scrub by 5s. Stepping opens the note, brings it to the centre of the viewport and releases Follow.

### Foundation Rows (review)

The five foundations in course order, 20px apart, beside the review's headline. A reviewed foundation: a 10px fill swatch outlined in its ink, its name in 0.875rem semibold ink, the verdict in its ink (semibold) followed by " · " and the summary in ink-2, and a 10px foundation lane on sunken (2px corners) showing where that foundation's notes fall as fill slices outlined in ink, with a 2px playhead (glass while playing, ink-3 paused) once played. A foundation that could not be judged follows the Not Judged Rule: dashed swatch, name and its own reason in ink-3, no lane. On phones, when more than one could not be judged, they share one row.

### Review Page (signature)

One booklet page holding the take line by line. It opens with the notes switch; then each line row: the mono timecode button (glass-ink for the current line; pressing it plays from there; above the line on phones, in the 4.5rem gutter from sm), then the line in lyric-on-tape type with its notes beneath it. The page carries no ribbon, gutter, margin column or playhead of its own; time is read on the transport's scrubber, and the page follows it.

- **Notes switch:** at the top of the page whenever the take has notes, 40px above the first line: a wrapping row of chips 8px apart (group "Notes to show"), "All notes" and then one chip per foundation in course order. A chip is square-shouldered (32px tall, 3px corners, 10px side padding), body small medium in ink-2 inside a one-pixel line-strong ring, holding a 10px foundation swatch outlined in its ink, the foundation's short name and its note count in mono (0.6875rem, at 70%); "All notes" has no swatch. Hover is sunken with ink text; pressed is ink fill with paper text and no ring. A foundation with no notes is disabled: ink-3 at 60%, a line ring, its swatch an empty line-strong outline. The switch filters the notes on the page, the transport's note slices and the stepper's count; the take facts under the headline and the foundation rows keep counting every note.
- **Silence rows:** between lines, space that grows with the pause (see Layout), with a 12px line-strong dash and the mono "x.x s" leader from 0.25s.
- **Noted words:** consecutive words under the same set of notes form one run, drawn by the One Colour at a Time Rule. With all notes in view a run carries a 2px line-strong underline (0.3em below the baseline, ink-3 on hover), whatever its notes are about; the words of the note in focus take that note's multiplied foundation fill from 10% to 92% of the line box. With one foundation in view its runs carry the fill at 50% (mixed with transparent) and the note in focus the full fill. Tentative is not drawn on the text; it lives on the note's pin and label. Pressing a noted phrase opens its note on that line without playing it; pressing again moves to the next note on the same words. A note without a passage marks its whole line.
- **Inside the words:** only for notes that are coloured, suggested phrases get a 2px underline in the foundation ink and, where a pause belongs but none was taken, a dashed 2px pauses-ink box (1.1em by 0.42em) sits in the line. Measured pauses of 0.3s or more show as a bar (1.6em per second, capped at 4em) in line-strong, or solid pauses ink when a coloured pauses note is on the run.
- **Karaoke:** while a line plays, its unspoken words wait in ink-3 and turn ink as they are said; the current word gets a 3px glass underline.
- **Notes:** a line's notes sit 16px under it as a list of one-line entries, 4px apart, max 38rem: every note in view about words on that line, in take order, including ones that began on an earlier line. Only the note in focus is open, on the line it was picked on or else the line it begins on.

### Note (review)

On a 1.25rem pin column: the 12px pin, centred on the entry's 24px line (no negative offsets). Closed, a note is one line in body small: the foundation's short name in its ink (semibold), the rule's label in ink-2 (ink on hover and when open), then in ink-3 "tentative" and, for a note listed on a later line than the one it begins on, "from an earlier line" (the two joined by " · "), and, pushed right, a small glass play triangle with the passage's mono time (the time goes glass-ink on hover). Open, the entry takes 8px of room above and below and adds, 4px down, the words the note is about, quoted in body small semibold ink on a chip of the note's own foundation fill (2px corners, 4px side padding, the fill repeating on each wrapped line; a passage of more than nine words keeps its first four and last three around an ellipsis), so note and text can be matched; a note without a passage has no quote. Then, 8px down, the observation in body medium ink; the why in body small ink-3; the practice line in body small medium ink after a corner-down-right arrow in the foundation ink; then suggestion buttons indented 24px, each a small glass play triangle (glass-ink on hover), the move in ink-2 and the quoted phrase in semibold ink ("Slow down on “night shift”"). The entry's line, with the quote and observation when open, is one button: it opens the note on that line, or closes it when it is already open there, and never plays. The play triangle and time on the right are their own button, which plays the passage (founder decision, 2026-10-03: reading a note must not start the audio). Hovering an entry previews it without opening it: its pin wears the ring and its words take the highlighter band. A note being played or stepped to opens by itself.

### Recorder Tape (upload)

The recorder is a booklet page with the tape across its top and the state content 40px below it. The tape is one minute, left to right, in a 56px paper lane well (4px corners, one-pixel line ring, 12px inset): what is recorded or chosen drawn as a mirrored, smoothed ink area; the rest a bare one-pixel line-strong hairline along the center (no dashes); mono ticks 00:00, 00:15, 00:30, 00:45 and 01:00 in ink-3 below, the first and last aligned to the ends. A 2px head standing 6px proud of the lane rides it in glass while recording or playing, ink when paused. While the coach listens, a glass `tape-scan` head sweeps the recorded length left to right and back. The recorder's round 44px play button is glass at rest and while playing. Dragging a file over the page lights a 2px glass ring. Beside the page, "The coach listens for" (label, ink-3) sits over a list of all five foundations (0.875rem semibold on a 24px line, 4px apart), each a fill swatch sitting on the text baseline and an ink name; while the coach works the label reads "The coach is listening for" in glass-ink, since all five are judged together.

### Note Pins

State by stroke. Filled in the foundation ink for a strength, open white ring for an improvement; a tentative pin's stroke is dashed in proportion to its radius. An active pin wears a 35% ring 3px outside. Pins sit in a 1.25rem column, centred on the note's label line (20px on the lyric sheet, 24px on a review entry), never pulled up by negative offsets.

### Lesson Track List

An ordered list of the five foundations, 40px apart, no dividers: mono two-digit track number in a narrow gutter, wide lesson name, one line of what it listens for, a 46px lane well on paper showing the sample read through that foundation (readings hidden where the lane is too narrow), and a measure line in ink-3.

### Retake Spine

Takes hang from a vertical line-strong spine with 16px open nodes. Each take shows its label, a verdict tag (ink-3 for needs work, the foundation ink for effective), the level curve as a multiplied foundation area with an ink line, a dashed marker and pin at the moment noted, and one line of note. The spine ends in a dashed 8px-radius slot on white ("Take 3 is yours") with the note's practice line and a primary "Record a take" button.

### Liner Notes Columns

On graphite, promises are set as continuous liner text: 1.0625rem on-graphite-muted body with a wide bold run-in title in on-graphite, two columns from 1280px, 32px between items, never broken across columns.

### Navigation

Wordmark, four 13px medium ink-2 section links (The example, Lessons, The retake, Promises), a small primary "Try a free review" right. The section in view goes ink with a 2px glass tick under it. When scrolled past 8px, the nav turns translucent paper with backdrop blur and gains a one-pixel line bottom edge. Below 768px, links move into a right sheet as spaced rows with a full-width large primary button.

## Do's and Don'ts

### Do:

- **Do** build every section as a spread on the 12-column grid: cover or title in the left five columns, reading in the right seven.
- **Do** draw a take's cover from the take: one ridge per line that showed a strength, from its level, filled with that foundation, stacked from the bottom on full-cover slots, clipped at the horizon, title on clean graphite below. Only a promotional sleeve fills every ridge.
- **Do** put reading on plain white booklet pages with the 10px corner.
- **Do** mark noted words with the foundation fill as multiplied highlighter, and set foundation text in its ink.
- **Do** resolve overlapping notes on the review with the notes switch and one note in focus: a quiet line-strong underline under every noted phrase, colour only for the note in focus or the one foundation in view.
- **Do** drive the sheet, the cover and the progress hairline from one playhead, with glass only on play controls and what is current.
- **Do** set timecodes, measurements, catalog numbers and track numbers in Martian Mono with tabular figures.
- **Do** keep layout spacing on 8px steps and text line heights on whole 4px steps.
- **Do** keep honesty about the example in the footer and on illustrated data (the dashed "Illustration" badge), and leave a dashed empty slot where a take does not exist yet.
- **Do** sell the outcome in copy: unlocking your voice, confidence, potential, learning and getting better.
- **Do** keep the first view sparse: headline, one outcome line, "Try a free review" and "See an example", the cover, then the example.
- **Do** turn off ridge-rise, ghost-drift and the tape scan under reduced motion, and let a following page jump line by line instead of easing.
- **Do** lay the review out as one long page under the transport: timecode and line per row, silences as space, notes listed under the line they are about, one line each, only the note in focus open and quoting its words in its own foundation fill, the scrubber as the only timeline.
- **Do** draw foundations that could not be judged with a dashed swatch and their own reason, never filled.
- **Do** release the page from the playhead the moment the reader scrolls, and offer Follow to bring it back.

### Don't:

- **Don't** use a foundation hue for decoration, section backgrounds, or emphasis unrelated to that foundation; the promotional sleeve is the only exception.
- **Don't** present covers as a feature in copy; they are brand texture.
- **Don't** put credits, verdict tables, badges or explanatory captions near the hero cover, or anything else that competes with listening to the example.
- **Don't** use glass on anything that is neither a play control nor live.
- **Don't** draw lines between list rows, notes, takes or page sections; lines are object edges or data.
- **Don't** put review notes in a side margin, or label the room notes take as time; silence is its own row.
- **Don't** layer several foundation colours on the same words of the review: no stripes, no stacked marks in different inks.
- **Don't** explain overlap with legends or "continues" markers; a note that began earlier is listed again under the line, marked "from an earlier line".
- **Don't** mark tentative on the review's words; it lives on the note's pin and label.
- **Don't** add a ribbon, tape gutter or second timeline beside the review's lines; the transport scrubber is the only one.
- **Don't** put large shadows on anything other than covers and booklet pages.
- **Don't** set words in mono, or labels in uppercase with tracking; no eyebrows above headings.
- **Don't** let the notebook become literal: no dot grids or dotted surfaces, ruled lines, binder rings, washi or sticky tape, handwriting fonts or stationery props. The notebook lives in structure only: notes under their line, one endless page per take, the 8px rhythm. (The recorder tape is the recorded take, an audio tape, and is native to the world.)
- **Don't** round badges, tags or swatches into pills; keep them at 3px or less.
- **Don't** use brown or walnut tones for surfaces, text or shadows; dark means neutral graphite.
