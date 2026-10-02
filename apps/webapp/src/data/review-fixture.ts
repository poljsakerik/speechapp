import sampleTake from "@/data/sample-take.json";
import type { ReviewResult } from "@/lib/api";
import { normalizeReview, type Take } from "@/lib/review";

/*
 * The landing page's sample take with a review in the shape the backend returns
 * (rate and pauses assessed, the rest not analyzed), so the review screen can be
 * designed without the review service: /upload?fixture in development, and the
 * specimens on /components.
 */
const take = sampleTake as Take;

const notAnalyzed = (foundation: string) => ({
  foundation,
  verdict: "uncertain",
  summary: "This foundation has not been analyzed yet.",
  findings: [],
});

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
      ],
    },
    notAnalyzed("volume"),
    notAnalyzed("pitch_melody"),
    notAnalyzed("tonality"),
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
      ],
    },
  ],
};

export const REVIEW_FIXTURE: ReviewResult = {
  take,
  review: normalizeReview(raw, take.segments),
  audioUrl: "/sample/take.mp3",
};
