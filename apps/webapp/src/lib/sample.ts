import type { Review } from "@/lib/review";
import { t as translate } from "../core/i18n/index.ts";

/*
 * The landing page's sample review. The take is voiced by a synthetic voice
 * (macOS `say`) and this review was written by hand in the
 * format the real coach returns. Both are labeled as a sample on the page.
 */
export const sampleTitle = () => translate("publicWebsite:sampleNightShift");

export const SAMPLE_REVIEW: Review = {
  get overall() {
    return translate("publicWebsite:sampleAClearStoryWithAStrongMiddleThe");
  },
  get nextTake() {
    return translate("publicWebsite:sampleSlowTheFirstLineDownAndHoldThe");
  },
  assessments: [
    {
      foundation: "rate",
      verdict: "mixed",
      get summary() {
        return translate(
          "publicWebsite:sampleRushedSetupWellJudgedSlowdownOnTheKey",
        );
      },
    },
    {
      foundation: "volume",
      verdict: "needs_work",
      get summary() {
        return translate("publicWebsite:sampleTheEndingDropsAway");
      },
    },
    {
      foundation: "pitch_melody",
      verdict: "mixed",
      get summary() {
        return translate("publicWebsite:sampleMostlyLevelOneContrastCouldLift");
      },
    },
    {
      foundation: "tonality",
      verdict: "uncertain",
      get summary() {
        return translate(
          "publicWebsite:sampleEvenAndNeutralThroughoutMayBeAChoice",
        );
      },
    },
    {
      foundation: "pauses",
      verdict: "effective",
      get summary() {
        return translate(
          "publicWebsite:sampleOneWellPlacedSilenceCarriesTheTurn",
        );
      },
    },
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
      get observation() {
        return translate("publicWebsite:sampleTheOpeningLineRunsAtOneFastPace");
      },
      get why() {
        return translate("publicWebsite:sampleThisLineSetsTheSceneAtThisSpeed");
      },
      get practice() {
        return translate(
          "publicWebsite:sampleSayTheFirstLineAgainAndGiveNight",
        );
      },
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
      get observation() {
        return translate(
          "publicWebsite:sampleYouStopForAboutASecondAfterNobody",
        );
      },
      get why() {
        return translate("publicWebsite:sampleTheGapMakesTheListenerLeanInThe");
      },
      get practice() {
        return translate("publicWebsite:sampleKeepThisPauseToTestItTryIt");
      },
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
      get observation() {
        return translate("publicWebsite:sampleTheHardestPartIsnTTheWorkStays");
      },
      get why() {
        return translate(
          "publicWebsite:sampleTheSentenceSetsTwoThingsAgainstEachOther",
        );
      },
      get practice() {
        return translate(
          "publicWebsite:sampleTryLiftingOnHardestAndLettingWorkFall",
        );
      },
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
      get observation() {
        return translate("publicWebsite:sampleItSSayingNoSlowsRightDownWell");
      },
      get why() {
        return translate("publicWebsite:sampleThisIsThePointOfTheStoryAnd");
      },
      get practice() {
        return translate(
          "publicWebsite:sampleKeepTheSlowdownAndLeaveTheSilenceAfter",
        );
      },
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
      get observation() {
        return translate(
          "publicWebsite:sampleTheLineSoundsEvenAndNeutralInThe",
        );
      },
      get why() {
        return translate(
          "publicWebsite:sampleTheWordsDescribeSomethingHardToDoA",
        );
      },
      get practice() {
        return translate(
          "publicWebsite:sampleRecordTheLineTwiceOnceFirmOnceAlmost",
        );
      },
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
      get observation() {
        return translate(
          "publicWebsite:sampleTheLevelDropsSharplyOnOutLoudAnd",
        );
      },
      get why() {
        return translate("publicWebsite:sampleTheEndingIsThePromiseOfTheTalk");
      },
      get practice() {
        return translate("publicWebsite:sampleKeepOutLoudAndMeanItAtThe");
      },
    },
  ],
};
