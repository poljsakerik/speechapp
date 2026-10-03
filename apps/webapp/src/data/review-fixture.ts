import sampleTake from "@/data/sample-take.json";
import type { ReviewResult } from "@/lib/api";
import { normalizeReview, type Take } from "@/lib/review";

/*
 * The landing page's sample take with a review in the shape the backend returns,
 * worded with the backend's own copy for all five foundations, so the review
 * screen can be designed without the review service: /upload?fixture in
 * development, and the specimens on /components.
 */
const take = sampleTake as Take;

const raw = {
  overall: "Review your rate of speech.",
  assessments: [
    {
      foundation: "rate",
      verdict: "mixed",
      summary:
        "There are a few places where a pace change may help the point land.",
      findings: [
        {
          segment_id: "s1",
          group_id: "0",
          rule_id: "RATE_IMPORTANCE_FAST",
          kind: "improvement",
          uncertainty: "tentative",
          observation: "This passage moves quickly.",
          why_it_matters:
            "A little more time can make this passage easier to follow.",
          practice:
            "Give this phrase a little more time, then resume your natural pace.",
          start: 0.35,
          end: 2.0,
          suggestions: [
            {
              direction: "slow_down",
              start: 1.49,
              end: 2.0,
              text: "night shift",
            },
          ],
        },
        {
          segment_id: "s4",
          group_id: "1",
          rule_id: "RATE_CONTRAST",
          kind: "improvement",
          uncertainty: "tentative",
          observation:
            "Your key points go by as fast as the setup around them.",
          why_it_matters:
            "Slowing down on what matters tells the listener what to focus on.",
          practice: "Slow down on the point, then move through the setup.",
          start: 12.41,
          end: 14.65,
          suggestions: [
            {
              direction: "slow_down",
              start: 13.49,
              end: 14.65,
              text: "out loud, and mean it",
            },
          ],
        },
        {
          segment_id: "s3",
          group_id: "strength-0",
          rule_id: "RATE_SLOWS_FOR_POINT",
          kind: "strength",
          uncertainty: "tentative",
          observation:
            "You slow right down on “It's saying no.”, to about 75% of your usual pace.",
          why_it_matters:
            "Slowing down on what matters is a verbal highlight: it tells the listener this is the part to focus on.",
          practice:
            "Keep this. In your next take, find the line that matters most and give it the same room.",
          start: 8.26,
          end: 9.24,
        },
      ],
    },
    {
      foundation: "volume",
      verdict: "mixed",
      summary: "Your voice drops or trails off in a few places.",
      findings: [
        {
          segment_id: "s4",
          group_id: "0",
          rule_id: "VOLUME_FADE",
          kind: "improvement",
          uncertainty: "tentative",
          observation: "Your voice trails off at the end of these sentences.",
          why_it_matters:
            "The end of a sentence often carries the point; when it fades, it gets lost.",
          practice:
            "Take a breath at the pause before, and carry your volume through to the last word.",
          start: 13.49,
          end: 14.65,
        },
      ],
    },
    {
      foundation: "pitch_melody",
      verdict: "effective",
      summary:
        "Your voice moves freely between high and low notes throughout this take. The marked stretches move the most.",
      findings: [
        {
          segment_id: "s4",
          group_id: "strength-0",
          rule_id: "PITCH_MELODY",
          kind: "strength",
          uncertainty: "tentative",
          observation:
            "Your voice moves freely between high and low notes through this stretch.",
          why_it_matters:
            "Melody tells listeners what matters and makes your message easier to remember, the way a song is.",
          practice:
            "Keep this range, and bring the same movement to the stretches where your voice settles on one note.",
          start: 10.44,
          end: 12.31,
        },
      ],
    },
    {
      foundation: "tonality",
      verdict: "mixed",
      summary:
        "Your voice sounds flat in places; a little more feeling would help the words land.",
      findings: [
        {
          segment_id: "s2",
          group_id: "0",
          rule_id: "TONE_FLAT",
          kind: "improvement",
          uncertainty: "tentative",
          observation:
            "Your voice sounds flat here, while the words call for concern.",
          why_it_matters:
            "Listeners connect with the feeling in your voice, not only with the words.",
          practice:
            "Decide what this passage should feel like, let your face show it, and say it again.",
          start: 5.71,
          end: 7.56,
        },
      ],
    },
    {
      foundation: "pauses",
      verdict: "mixed",
      summary: "Some pauses are missing, out of place, too short or too long.",
      findings: [
        {
          segment_id: "s2",
          group_id: "0",
          rule_id: "PAUSE_TOO_LONG",
          kind: "improvement",
          uncertainty: "clear",
          observation: "This silence goes on too long.",
          why_it_matters:
            "A silence this long stops sounding deliberate, and the listener starts to wonder if you lost your place.",
          practice: "Keep the pause, but move on after a beat or two.",
          start: 3.86,
          end: 6.07,
          suggestions: [
            {
              direction: "shorten_pause_after",
              start: 4.47,
              end: 4.66,
              text: "you",
            },
          ],
        },
        {
          segment_id: "s4",
          group_id: "1",
          rule_id: "PAUSE_NECESSARY",
          kind: "improvement",
          uncertainty: "clear",
          observation: "This stretch runs on without a pause.",
          why_it_matters:
            "A pause gives the listener a moment to take in what you just said.",
          practice:
            "Stop at the marked place and let the point land before you go on.",
          start: 10.44,
          end: 11.8,
          suggestions: [
            {
              direction: "pause_after",
              start: 10.59,
              end: 11.04,
              text: "tonight,",
            },
          ],
        },
        {
          segment_id: "s2",
          group_id: "strength-0",
          rule_id: "PAUSE_BUILDS_ANTICIPATION",
          kind: "strength",
          uncertainty: "clear",
          observation:
            "You pause for 0.7 seconds just before “It's saying no.”",
          why_it_matters:
            "Holding back what comes next makes the listener lean in for it.",
          practice:
            "Keep it. Try the same pause before your next answer or reveal.",
          start: 7.29,
          end: 7.56,
        },
        {
          segment_id: "s3",
          group_id: "strength-0",
          rule_id: "PAUSE_BUILDS_ANTICIPATION",
          kind: "strength",
          uncertainty: "clear",
          observation:
            "You pause for 0.7 seconds just before “It's saying no.”",
          why_it_matters:
            "Holding back what comes next makes the listener lean in for it.",
          practice:
            "Keep it. Try the same pause before your next answer or reveal.",
          start: 8.26,
          end: 9.24,
        },
      ],
    },
  ],
};

export const REVIEW_FIXTURE: ReviewResult = {
  take,
  review: normalizeReview(raw, take.segments),
  audioUrl: "/sample/take.mp3",
};
