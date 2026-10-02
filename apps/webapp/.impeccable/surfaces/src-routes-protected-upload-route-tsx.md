---
version: 1
slug: "src-routes-protected-upload-route-tsx"
primary_target: "src/routes/_protected.upload/route.tsx"
related_targets: ["src/components/feedback/FeedbackView.tsx","src/components/try/TryReview.tsx","src/pages/Components.tsx"]
---

# Upload and review (the take workspace)

Mode: Operate. Visitor: someone who just recorded or uploaded a take and wants to understand how they spoke. Task: hear a passage, read the note on it, know what to try next. Frequency: every take. Companion: /components showcase follows the same language (Read mode, a specimen booklet).

Founder answers (2026-10-02): this round is about data display, not the retake flow; no take covers on these screens (covers belong on a future takes list page); the /components showcase is redesigned too.

Product truth to keep (updated 2026-10-02 after rebasing on main): the live review assesses all five foundations. A foundation the backend returns as uncertain shows its own reason with a dashed swatch and must never read as passed. Rate notes are tentative, pause notes clear. Every note can be played. Space toggles playback, J/K step notes, Arrow keys scrub.

Founder changes after the build (2026-10-02):
- No dot grid on any page: dotted surfaces read cheap and decorative. Pages are plain white.
- Small orange details tie things together: play controls are orange glass at rest, note play triangles are glass.
- No vertical ribbon on the review: the transport's scrubber, with note slices and the glass playhead, is the timeline. (Supersedes the contract's ribbon gutter below.)
- Recorder tape on upload is horizontal, one minute left to right.
- Take covers stack only strength ridges up from the bottom; no dashed crests.

## Direction contract

THESIS: The take is a tape that runs down the page: each spoken line sits at its moment beside a vertical ribbon of the take's own level, silences open real space, and every note hangs in the margin at the height of its words. Refuses the horizontal waveform-editor and the popover-on-highlight transcript.
OWN-WORLD: Liner Notes as recorded in DESIGN.md: one long white booklet page with the 24px dot grid on paper ground; wide Archivo lines; Martian Mono timecodes and measured syllables per second; foundation fills as multiplied highlighter on words and as bands across the ribbon; pins filled/open, solid/dashed; a graphite transport strip; orange glass only for the playhead, the current word and the record state.
STORY: The reader sees which foundations were reviewed and which were not, plays the take and watches the ribbon fill as the page follows the playhead, jumps note to note, presses a highlighted phrase or a note to hear that passage, and reads one practice line per note.
FIRST VIEWPORT: Sticky graphite transport (play, mono time, scrubber with note slices and glass playhead, speed, note stepper, follow, upload another). Below it a spread: left five columns the headline "Notes on your take" with mono take facts; right seven, the five foundations as rows, reviewed ones with verdict and summary, the other three dashed and "Not reviewed yet". Then the page: ribbon gutter, timecode and rate, the lyric line, notes in a five-column margin.
FORM: The tape runs down the page, my list #7 (dealt lead), seed 688ff1fe.
SIGNATURE INTERACTION: While playing, the ribbon fills with ink behind a glass playhead and the page scrolls so the playhead holds at reading height; any manual scroll releases it and a Follow control brings it back. Reduced motion jumps line by line.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
