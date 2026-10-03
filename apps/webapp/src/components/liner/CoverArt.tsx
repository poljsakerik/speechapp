import { PUBLIC_WEBSITE_NS, REVIEW_NS } from "@/core/i18n";
import { useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FOUNDATION_BY_KEY } from "@/lib/foundations";
import type { Review, Take } from "@/lib/review";
import { cn } from "@micmane/ui/lib/utils";

const W = 600;
const X0 = 44;
const X1 = 556;
const POINTS = 72;
/** Ridges stop at a hard horizon; the title sits on clean graphite below it. */
const HORIZON = 452;

type Ridge = {
  id: string;
  d: string;
  crest: [number, number][];
  fill: string;
  start: number;
  end: number;
};

/** Average over a window, twice: the level reads as a soft crest, not a spiky meter. */
function smooth(values: number[], radius: number) {
  const pass = (v: number[]) =>
    v.map((_, i) => {
      let sum = 0;
      let count = 0;
      for (
        let j = Math.max(0, i - radius);
        j <= Math.min(v.length - 1, i + radius);
        j++
      ) {
        sum += v[j];
        count++;
      }
      return sum / count;
    });
  return pass(pass(values));
}

/** Catmull-Rom through the crest points, as cubic Béziers. */
function curve(points: [number, number][]) {
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

type Span = { id: string; start: number; end: number; fill: string };

/**
 * One ridge per line that showed a strength, drawn from that line's recorded level
 * and filled with the colour of its first strength. Ridges stack up from the
 * horizon in line order, each taking the slot it would have on a full cover, so a
 * take with few strengths is a low stack and covers fill up as practice adds them.
 *
 * `palette` is for promotional covers: the take is cut into one even slice per
 * colour instead, every ridge filled.
 */
function useRidges(take: Take, review: Review, palette?: string[]): Ridge[] {
  return useMemo(() => {
    const volume = take.volume ?? take.peaks;
    const n = volume.length;
    const peak = Math.max(...volume, 0.001);
    const first = take.segments[0]?.start ?? 0;
    const last = take.segments[take.segments.length - 1]?.end ?? take.duration;
    const spans: Span[] = palette
      ? palette.map((fill, i) => ({
          id: `slice-${i}`,
          start: first + ((last - first) * i) / palette.length,
          end: first + ((last - first) * (i + 1)) / palette.length,
          fill,
        }))
      : take.segments.flatMap((segment) => {
          const strength = review.findings.find(
            (f) => f.segmentId === segment.id && f.kind === "strength",
          );
          return strength
            ? [
                {
                  id: segment.id,
                  start: segment.start,
                  end: segment.end,
                  fill: FOUNDATION_BY_KEY[strength.foundation].fill,
                },
              ]
            : [];
        });
    // Slots are spaced as for a cover where every line is filled; the stack sits on the lowest ones.
    const lines = palette ? spans.length : Math.max(1, take.segments.length);
    const top = 168;
    const bottom = 392;
    const step = lines > 1 ? (bottom - top) / (lines - 1) : 0;
    const lift = 128 * Math.min(1, 4 / lines);
    const offset = lines - spans.length;
    return spans.map((segment, i) => {
      const index = offset + i;
      const raw = Array.from({ length: POINTS }, (_, i) => {
        const t =
          segment.start + ((segment.end - segment.start) * i) / (POINTS - 1);
        return (
          volume[Math.min(n - 1, Math.floor((t / take.duration) * n))] / peak
        );
      });
      const level = smooth(raw, 3);
      const base = top + index * step;
      // Taper both ends to the baseline so every ridge reads as one rounded form.
      const crest: [number, number][] = level.map((v, i) => {
        const edge = Math.sin((Math.PI * i) / (POINTS - 1)) ** 0.6;
        return [
          X0 + ((X1 - X0) * i) / (POINTS - 1),
          base - (14 + v * lift) * edge,
        ];
      });
      const line = curve(crest);
      const d = `${line} L${X1},${base + 150} L${X0},${base + 150} Z`;
      return {
        id: segment.id,
        d,
        crest,
        fill: segment.fill,
        start: segment.start,
        end: segment.end,
      };
    });
  }, [take, review, palette]);
}

type CoverArtProps = {
  take: Take;
  review: Review;
  title: string;
  /** Seconds into the take; the lit bead rides the crest of the line being spoken. */
  time?: number;
  live?: boolean;
  /** Promotional covers: one evenly sliced, filled ridge per colour. */
  palette?: string[];
  top?: ReactNode;
  bottom?: ReactNode;
  className?: string;
};

export function CoverArt({
  take,
  review,
  title,
  time = 0,
  live = false,
  palette,
  top,
  bottom,
  className,
}: CoverArtProps) {
  const { t: translate } = useTranslation([REVIEW_NS, PUBLIC_WEBSITE_NS]);
  const ridges = useRidges(take, review, palette);
  const clipId = `horizon-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const current = live
    ? ridges.findIndex((r) => time >= r.start && time <= r.end)
    : -1;
  const bead = (() => {
    if (current < 0) return null;
    const r = ridges[current];
    const at = ((time - r.start) / (r.end - r.start)) * (r.crest.length - 1);
    const i = Math.max(0, Math.min(r.crest.length - 2, Math.floor(at)));
    const k = at - i;
    const [xa, ya] = r.crest[i];
    const [xb, yb] = r.crest[i + 1];
    return { x: xa + (xb - xa) * k, y: ya + (yb - ya) * k };
  })();

  return (
    <figure
      className={cn(
        "relative isolate aspect-square overflow-hidden rounded-[10px] bg-graphite text-on-graphite",
        className,
      )}
      aria-label={
        palette
          ? translate("publicWebsite:coverLevel", { title })
          : translate("publicWebsite:coverStrengths", { title })
      }
    >
      <svg
        viewBox={`0 0 ${W} ${W}`}
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <clipPath id={clipId}>
          <rect x="0" y="0" width={W} height={HORIZON} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {ridges.map((r, i) => (
            <g
              key={r.id}
              className="cover-ridge transition-opacity duration-500"
              style={{
                animationDelay: `${180 + i * 140}ms`,
                opacity: current >= 0 && current !== i ? 0.42 : 1,
              }}
            >
              <path
                d={r.d}
                fill={r.fill}
                stroke="var(--graphite)"
                strokeWidth="5"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
        {bead && (
          <g>
            <circle
              cx={bead.x}
              cy={bead.y}
              r="15"
              fill="var(--glass)"
              opacity="0.28"
            />
            <circle
              cx={bead.x}
              cy={bead.y}
              r="7.5"
              fill="var(--glass)"
              stroke="var(--graphite)"
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5 sm:p-6">
        {top}
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
        {bottom}
      </figcaption>
    </figure>
  );
}
