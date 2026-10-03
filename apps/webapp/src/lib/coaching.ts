import {
  findingRules,
  type FindingEvidence,
  type FindingRule,
} from "@micmane/validation/feedback";
import {
  formatList,
  formatNumber,
  t,
  type TranslationKey,
} from "../core/i18n/index.ts";
import type { FoundationKey } from "./foundations.ts";

export function findingCopy(ruleId: string, evidence: FindingEvidence = {}) {
  if (!findingRules.includes(ruleId as FindingRule)) return undefined;
  const rule = ruleId as FindingRule;
  const quote = t("review:quote", {
    text: (evidence.focusText ?? "").replace(/[.,;:]+$/, ""),
  });
  const feelings = formatList(
    (evidence.expected ?? [])
      .filter((emotion) => emotion !== "neutral")
      .slice(0, 2)
      .map((emotion) => t(`review:feeling_${emotion}`)),
  );
  const seconds = evidence.seconds ?? 0;
  let observation = t(`review:${rule}_observation`, {
    quote,
    count: seconds,
    seconds: formatNumber(seconds, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    pace: formatNumber(Math.round((100 * 2 ** (evidence.pace ?? 0)) / 5) * 5),
    feelings,
  });
  if (rule === "TONE_FLAT" && feelings)
    observation = t("review:TONE_FLAT_expected", { feelings });
  if (rule === "TONE_EXPRESSIVE")
    observation = t(
      !feelings
        ? "review:TONE_EXPRESSIVE_generic"
        : (evidence.expressiveness ?? 0) >= 5
          ? "review:TONE_EXPRESSIVE_vivid"
          : "review:TONE_EXPRESSIVE_observation",
      { feelings },
    );
  return {
    observation,
    why: t(`review:${rule}_why_it_matters`),
    practice: t(`review:${rule}_practice`),
  };
}

const summaryCodes: Record<FoundationKey, readonly string[]> = {
  rate: ["uncertain", "mixed", "effective"],
  volume: ["uncertain", "mixed", "effective"],
  pauses: ["uncertain", "mixed", "effective"],
  pitch_melody: ["uncertain", "mixed", "effective", "lively", "lively_marked"],
  tonality: [
    "uncertain",
    "mixed",
    "effective",
    "expressive",
    "expressive_marked",
  ],
};

export function assessmentCopy(foundation: FoundationKey, code: string) {
  if (code === "unassessed") return t("review:unassessed");
  const safeCode = summaryCodes[foundation].includes(code) ? code : "uncertain";
  return t(`review:summary_${foundation}_${safeCode}` as TranslationKey);
}
