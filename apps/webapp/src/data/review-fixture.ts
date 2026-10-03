import sampleTake from "@/data/sample-take.json";
import type { ReviewResult } from "@/lib/api";
import { normalizeReview, type Take } from "@/lib/review";

// Recording content stays in its original language. Coaching uses the same
// evidence contract and frontend translations as a real review response.
const take = sampleTake as Take;
const raw = {
  assessments: [
    {
      foundation: "rate",
      verdict: "mixed",
      findings: [
        {
          segment_id: "s1",
          group_id: "0",
          rule_id: "RATE_IMPORTANCE_FAST",
          kind: "improvement",
          uncertainty: "tentative",
          start: 0.35,
          end: 2,
          suggestions: [
            {
              direction: "slow_down",
              start: 1.49,
              end: 2,
              text: "night shift",
            },
          ],
          evidence: {},
        },
        {
          segment_id: "s4",
          group_id: "1",
          rule_id: "RATE_CONTRAST",
          kind: "improvement",
          uncertainty: "tentative",
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
          evidence: {},
        },
        {
          segment_id: "s3",
          group_id: "strength-0",
          rule_id: "RATE_SLOWS_FOR_POINT",
          kind: "strength",
          uncertainty: "tentative",
          start: 8.26,
          end: 9.24,
          evidence: {
            focusText: "It's saying no.",
            pace: -0.4150374992788438,
          },
        },
      ],
      summaryCode: "mixed",
    },
    {
      foundation: "volume",
      verdict: "mixed",
      findings: [
        {
          segment_id: "s4",
          group_id: "0",
          rule_id: "VOLUME_FADE",
          kind: "improvement",
          uncertainty: "tentative",
          start: 13.49,
          end: 14.65,
          evidence: {},
        },
      ],
      summaryCode: "mixed",
    },
    {
      foundation: "pitch_melody",
      verdict: "effective",
      findings: [
        {
          segment_id: "s4",
          group_id: "strength-0",
          rule_id: "PITCH_MELODY",
          kind: "strength",
          uncertainty: "tentative",
          start: 10.44,
          end: 12.31,
          evidence: {},
        },
      ],
      summaryCode: "lively_marked",
    },
    {
      foundation: "tonality",
      verdict: "mixed",
      findings: [
        {
          segment_id: "s2",
          group_id: "0",
          rule_id: "TONE_FLAT",
          kind: "improvement",
          uncertainty: "tentative",
          start: 5.71,
          end: 7.56,
          evidence: {
            expected: ["sad"],
          },
        },
      ],
      summaryCode: "mixed",
    },
    {
      foundation: "pauses",
      verdict: "mixed",
      findings: [
        {
          segment_id: "s2",
          group_id: "0",
          rule_id: "PAUSE_TOO_LONG",
          kind: "improvement",
          uncertainty: "clear",
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
          evidence: {},
        },
        {
          segment_id: "s4",
          group_id: "1",
          rule_id: "PAUSE_NECESSARY",
          kind: "improvement",
          uncertainty: "clear",
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
          evidence: {},
        },
        {
          segment_id: "s2",
          group_id: "strength-0",
          rule_id: "PAUSE_BUILDS_ANTICIPATION",
          kind: "strength",
          uncertainty: "clear",
          start: 7.29,
          end: 7.56,
          evidence: {
            seconds: 0.7,
            focusText: "It's saying no.",
          },
        },
        {
          segment_id: "s3",
          group_id: "strength-0",
          rule_id: "PAUSE_BUILDS_ANTICIPATION",
          kind: "strength",
          uncertainty: "clear",
          start: 8.26,
          end: 9.24,
          evidence: {
            seconds: 0.7,
            focusText: "It's saying no.",
          },
        },
      ],
      summaryCode: "mixed",
    },
  ],
  mainMessage: "",
};

export const REVIEW_FIXTURE: ReviewResult = {
  take,
  review: normalizeReview(raw, take.segments),
  audioUrl: "/sample/take.mp3",
};
