import { cn } from "@/lib/utils"

/**
 * Placeholder mark: a microphone wearing a mane. Replace with the designed
 * logo when it exists; keep the iridescent film as its material.
 */
const MANE = ["var(--f-rate-ink)", "var(--f-volume-ink)", "var(--f-pitch-ink)", "var(--f-tonality-ink)", "var(--f-pauses-ink)"]

export function Mark({ className }: { className?: string }) {
  const strands = Array.from({ length: 9 }, (_, i) => -120 + i * 30)
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      {/* The mane runs through all five foundation inks, left to right. */}
      <g strokeWidth="2.6" strokeLinecap="round">
        {strands.map((deg, i) => (
          <line
            key={deg}
            x1="16"
            y1="8.5"
            x2="16"
            y2="0.9"
            stroke={MANE[Math.round((i / (strands.length - 1)) * (MANE.length - 1))]}
            transform={`rotate(${deg} 16 11.5)`}
          />
        ))}
      </g>
      <rect x="12.2" y="6.6" width="7.6" height="11.8" rx="3.8" fill="var(--ink)" />
      <path d="M16 18.4v6.2M11.8 27.6h8.4" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <Mark />
      <span className="font-wide text-[1.0625rem] font-extrabold tracking-[-0.02em]">MicMane</span>
    </span>
  )
}
