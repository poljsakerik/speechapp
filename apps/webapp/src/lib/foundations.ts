import { t as translate } from "../core/i18n/index.ts";
// The five foundations, in course order. Names and principles follow
// speechapp/rubric.py; the careful wording is part of the product.
export type FoundationKey =
  "rate" | "volume" | "pitch_melody" | "tonality" | "pauses";

export type Foundation = {
  key: FoundationKey;
  label: string;
  short: string;
  fill: string;
  ink: string;
  listensFor: string;
  measure: string;
  wontClaim: string;
};

export const FOUNDATIONS: Foundation[] = [
  {
    key: "rate",
    get label() {
      return translate("common:foundationsRateOfSpeech");
    },
    get short() {
      return translate("common:foundationsRate");
    },
    fill: "var(--f-rate)",
    ink: "var(--f-rate-ink)",
    get listensFor() {
      return translate(
        "common:foundationsWhetherImportantPointsGetEnoughTimeAndWhether",
      );
    },
    get measure() {
      return translate("common:foundationsSyllablesPerSecondIncludingSilence");
    },
    get wontClaim() {
      return translate("common:foundationsUniformPaceIsNotAFaultOnIts");
    },
  },
  {
    key: "volume",
    get label() {
      return translate("common:foundationsVolume");
    },
    get short() {
      return translate("common:foundationsVolume");
    },
    fill: "var(--f-volume)",
    ink: "var(--f-volume-ink)",
    get listensFor() {
      return translate(
        "common:foundationsProjectionAndContrastThatSupportTheMessageAnd",
      );
    },
    get measure() {
      return translate("common:foundationsRecordedLevelAcrossTheTake");
    },
    get wontClaim() {
      return translate("common:foundationsRecordedLevelIsNotHowLoudYouWere");
    },
  },
  {
    key: "pitch_melody",
    get label() {
      return translate("common:foundationsPitchMelody");
    },
    get short() {
      return translate("common:foundationsPitch");
    },
    fill: "var(--f-pitch)",
    ink: "var(--f-pitch-ink)",
    get listensFor() {
      return translate(
        "common:foundationsMelodicMovementThatCarriesMeaningWhichWordLifts",
      );
    },
    get measure() {
      return translate("common:foundationsPitchContourRelativeToYourOwnVoice");
    },
    get wontClaim() {
      return translate(
        "common:foundationsABiggerRangeIsNotAutomaticallyBetterAnd",
      );
    },
  },
  {
    key: "tonality",
    get label() {
      return translate("common:foundationsTonality");
    },
    get short() {
      return translate("common:foundationsTonality");
    },
    fill: "var(--f-tonality)",
    ink: "var(--f-tonality-ink)",
    get listensFor() {
      return translate("common:foundationsHowTheExpressionYouCanHearFitsWhat");
    },
    get measure() {
      return translate("common:foundationsHeardNotMeasured");
    },
    get wontClaim() {
      return translate("common:foundationsItDescribesHowYouSoundNeverWhatYou");
    },
  },
  {
    key: "pauses",
    get label() {
      return translate("common:foundationsPauses");
    },
    get short() {
      return translate("common:foundationsPauses");
    },
    fill: "var(--f-pauses)",
    ink: "var(--f-pauses-ink)",
    get listensFor() {
      return translate(
        "common:foundationsSpaceThatGivesTheListenerTimeToProcess",
      );
    },
    get measure() {
      return translate("common:foundationsSilencesAndTheirLength");
    },
    get wontClaim() {
      return translate("common:foundationsACommaDoesNotRequireAPause");
    },
  },
];

export const FOUNDATION_BY_KEY = Object.fromEntries(
  FOUNDATIONS.map((f) => [f.key, f]),
) as Record<FoundationKey, Foundation>;

export const VERDICT_LABEL = {
  get effective() {
    return translate("common:foundationsEffective");
  },
  get mixed() {
    return translate("common:foundationsMixed");
  },
  get needs_work() {
    return translate("common:foundationsNeedsWork");
  },
  get uncertain() {
    return translate("common:foundationsUncertain");
  },
} as const;
