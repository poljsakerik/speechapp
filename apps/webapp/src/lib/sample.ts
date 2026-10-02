import type { Review } from "@/lib/review"

/*
 * The landing page's sample review. The take is voiced by a synthetic voice
 * (macOS `say`) and this review was written by hand in the
 * format the real coach returns. Both are labeled as a sample on the page.
 */
export const SAMPLE_TITLE = "Night shift"

export const SAMPLE_REVIEW: Review = {
  overall:
    "A clear story with a strong middle. The pause and the slow “It's saying no” do real work. The opening rushes, and the ending fades on the very words “out loud”.",
  nextTake: "Slow the first line down, and hold the last one up.",
  assessments: [
    { foundation: "rate", verdict: "mixed", summary: "Rushed setup, well-judged slowdown on the key line." },
    { foundation: "volume", verdict: "needs_work", summary: "The ending drops away." },
    { foundation: "pitch_melody", verdict: "mixed", summary: "Mostly level; one contrast could lift." },
    { foundation: "tonality", verdict: "uncertain", summary: "Even and neutral throughout; may be a choice." },
    { foundation: "pauses", verdict: "effective", summary: "One well-placed silence carries the turn." },
  ],
  findings: [
    {
      id: "rate-1",
      foundation: "rate",
      segmentId: "s1",
      ruleId: "RATE_IMPORTANCE",
      kind: "improvement",
      uncertainty: "clear",
      at: 1.5,
      span: [1.49, 1.74],
      observation:
        "The opening line runs at one fast pace, about 5.4 syllables a second. “Night shift” and “clinic downtown” get no more time than the words around them.",
      why: "This line sets the scene. At this speed the listener catches the facts but has no time to picture them.",
      practice: "Say the first line again and give “night shift” a beat longer than anything else in it.",
    },
    {
      id: "pauses-1",
      foundation: "pauses",
      segmentId: "s2",
      ruleId: "PAUSE_PROCESSING",
      kind: "strength",
      uncertainty: "clear",
      at: 4.66,
      span: [4.47, 4.47],
      observation: "You stop for about a second after “nobody tells you”.",
      why: "The gap makes the listener lean in. The point lands harder because they had to wait for it.",
      practice: "Keep this pause. To test it, try it half as long and listen for what you lose.",
    },
    {
      id: "pitch-1",
      foundation: "pitch_melody",
      segmentId: "s2",
      ruleId: "PITCH_VARIETY",
      kind: "improvement",
      uncertainty: "tentative",
      at: 6.3,
      span: [6.25, 7.29],
      observation:
        "“The hardest part isn't the work” stays close to one pitch. The contrast between “hardest part” and “the work” isn't carried by the melody.",
      why: "The sentence sets two things against each other, and pitch movement can tell the listener which one matters. Other readings could work too.",
      practice: "Try lifting on “hardest” and letting “work” fall away.",
    },
    {
      id: "rate-2",
      foundation: "rate",
      segmentId: "s3",
      ruleId: "RATE_IMPORTANCE",
      kind: "strength",
      uncertainty: "clear",
      at: 8.3,
      span: [8.26, 8.99],
      observation: "“It's saying no” slows right down, well below the rest of the take.",
      why: "This is the point of the story, and it gets the most time. The slowdown tells the listener to take it seriously.",
      practice: "Keep the slowdown, and leave the silence after it just as long.",
    },
    {
      id: "tonality-1",
      foundation: "tonality",
      segmentId: "s3",
      ruleId: "TONE_EXPRESSIVENESS",
      kind: "improvement",
      uncertainty: "tentative",
      at: 8.95,
      span: [8.26, 8.99],
      observation: "The line sounds even and neutral, in the same tone as the setup before it.",
      why: "The words describe something hard to do. A shift here, firmer or quieter and more personal, could carry that. A neutral reading can also work if you want restraint.",
      practice: "Record the line twice: once firm, once almost confiding. Keep the one that sounds like you mean it.",
    },
    {
      id: "volume-1",
      foundation: "volume",
      segmentId: "s4",
      ruleId: "VOLUME_ENDINGS",
      kind: "improvement",
      uncertainty: "clear",
      at: 13.5,
      span: [13.49, 14.45],
      observation: "The level drops sharply on “out loud, and mean it”, the last words of the take.",
      why: "The ending is the promise of the talk, and it is the hardest part to hear. The drop also works against the words themselves.",
      practice: "Keep “out loud, and mean it” at the level of “So tonight”. Push breath through the last word rather than starting louder.",
    },
  ],
}
