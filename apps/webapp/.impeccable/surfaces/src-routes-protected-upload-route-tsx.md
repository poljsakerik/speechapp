---
version: 1
slug: "src-routes-protected-upload-route-tsx"
primary_target: "src/routes/_protected.upload/route.tsx"
related_targets: ["src/components/feedback/FeedbackView.tsx","src/components/try/TryReview.tsx","src/pages/Components.tsx"]
---

# Upload and review (the take workspace)

Mode: Operate. Visitor: someone who just recorded or uploaded a take and wants to understand how they spoke. Task: read a note, hear its passage, know what to try next. Frequency: every take. Companion: the /components showcase follows the same language (Read mode, a specimen booklet).

Product truth to keep: the live review assesses all five foundations and returns strengths as well as things to work on. A foundation the backend returns as uncertain shows its own reason with a dashed swatch and must never read as passed. Every note can be played. Space toggles playback, J/K step notes, Arrow keys scrub. No take covers on these screens (covers belong on a future takes list page).

## Founder decisions, in order (2026-10-02 to 2026-10-03)

How the founder steers this surface: less to read every time; one meaning per mark; nothing decorative. When a display needs a legend, a count or a repeated sentence to be understood, it is the display that is wrong.

- No dot grid on any page ("cheap instead of chic", "decorative and confusing"). Pages are plain white.
- Small orange details tie things together: play controls are orange glass at rest; note play triangles are glass.
- No vertical ribbon on the review ("very ugly", "hard to look at"): the transport's scrubber with note slices and the glass playhead is the only timeline. The recorder tape on upload is horizontal, one minute left to right.
- Take covers stack only strength ridges up from the bottom; no dashed crests.
- Upload: no fine print; file type and size limits are validation feedback when a file is chosen. A spread centred vertically, the card's padding equal on all sides, the left column exactly the card's height with the letters (not their line boxes) meeting its top and bottom edges.
- Review header: headline and take facts only. No lead paragraph, no keyboard hint, no syllables-per-second reading, no "x.x s" labels on silences (space alone carries them).
- Notes sit under the line they are about, never in a side column ("difficult to connect the notes with the text").
- Overlapping notes are never layered as stripes, and nothing is explained with "continues" markers ("there is no way a user will know what is going on here"). A switch shows all notes, only what to work on, only strengths, and one foundation at a time.
- A note that runs over several lines is written once, under the line it begins on, with a bar in the margin beside every line it covers ("from an earlier line" was hard to follow).
- Reading and hearing are separate: opening a note never starts playback ("super annoying"); the play triangle and time are their own button.
- Good and bad must be told apart in the mixed view itself, not by a small label: colour on the words means a strength (a band in its foundation's fill); something to work on is a dark underline. The note in focus has its words to itself: other notes' marks on those words step back.
- Kind is an icon in the note's pin (tick in a filled disc, upward arrow in an open ring), not a position or a word: left/right sides for work and strengths were tried and dropped, because a line with only strengths had nothing to stand against.
- A note says as little as possible: foundation, rule name, "tentative" when it is. No "strength"/"to work on" words, no line count. Open, it shows the quoted words, why it matters, what to try and the phrases to play; the observation sentence is not printed (it repeated the rule name).

Unresolved, raised with the founder and not decided:
- Some observations carried detail the rule name and quote do not ("to about 75% of your usual pace", "0.7 seconds"); it no longer shows anywhere.
- The landing lyric sheet still puts a colour band behind things to work on and dims unspoken words to 35% ink; "colour means a strength" holds only on the review.
- The unpressed "Your take" sleeve on the landing page still drifts dashed outline ridges; the "Take 3 is yours" node is glass though it is neither a play control nor live.
- The dev fixture (/upload?fixture) is hand-written in the backend's wording; strengths have not been seen on a real recording yet.

## Direction contract

THESIS: A reviewed take is one long page of its own words: each line with its timecode, silences as space, and the notes about it listed underneath, one in focus at a time. Refuses the horizontal waveform editor, the popover-on-highlight transcript, and any display that layers several notes' colours on the same words.
OWN-WORLD: Liner Notes as recorded in DESIGN.md: one long white booklet page on paper ground; wide Archivo lines; Martian Mono timecodes; a graphite transport strip; orange glass for play controls and whatever is live. On the words, a band in a foundation's fill is a strength and a dark underline is something to work on; pins carry a tick or an arrow.
STORY: The reader sees which foundations are working, which have something to work on and which could not be judged; scans the lines for colour (kept) and underlines (to work on); opens a note to read why it matters and what to try, and presses play only when they want to hear it; narrows the page to what to work on, to strengths, or to one foundation.
FIRST VIEWPORT: Sticky graphite transport (glass play, mono time, scrubber with note slices and glass playhead, speed, note stepper, follow, another take). Below it a spread: left five columns the headline "Notes on your take" with the take facts; right seven, the five foundations as rows with a filled or open swatch, verdict, summary and a lane of where their notes fall. Then the page: the notes switch, then timecode and line, with the line's notes listed beneath.
FORM: Began as "The tape runs down the page", my list #7 (dealt lead), seed 688ff1fe; the ribbon and the margin were removed by founder decision, leaving the long page with notes under each line.
SIGNATURE INTERACTION: One note in focus. Opening a note (pressing its words, its entry or its margin bar) colours exactly its words and clears every other mark from them, without starting the audio. While the take plays, the page scrolls so the line being spoken holds at reading height; any manual scroll releases it and Follow brings it back. Reduced motion jumps line by line.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
