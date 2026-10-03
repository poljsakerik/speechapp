# Source

Adapted from Emil Kowalski's skills, [emilkowalski/skills](https://github.com/emilkowalski/skills)
(MIT License, Copyright (c) 2026 Emil Kowalski). The animation philosophy, gate, standards, values,
and recipes are his.

Merged into one reviewer skill from:

- `find-animation-opportunities`: the four-question gate, the hunt list, the rejected-candidates requirement, the output cap.
- `review-animations` and its `STANDARDS.md`: the ten standards, escalation triggers, remedial hierarchy, value tables.
- `improve-animations`, `AUDIT.md`, and `PLAN-TEMPLATE.md`: writing for an executor with zero context and zero taste, the self-contained spec structure, the feel check.
- `animate` and its `RECIPES.md`: tool selection and the implementation recipes.
- `emil-design-eng`: perceived performance, clip-path techniques, tooltip delay skipping, cohesion.
- `apple-design`: gesture response, velocity handoff, momentum projection, rubber-banding, spring defaults.
- `animation-vocabulary`: the term list.
- `performance-cheatsheet.md`.

Not used: `animate-expo`, `write-swift`, `mobile-native`, `ask-sonner`, `pick-ui-library`, `prototype`,
`break-ui` (native, non-motion, or build-time skills).

Changes for use as a T3 workflow reviewer:

- Two skills that each "do one thing" (find, review) became two passes of a single diff-scoped review.
- Output moved from Markdown tables to findings for T3's review response contract, with a severity mapping,
  because only blocking findings are returned to the implementer.
- Every finding carries the full implementation, since the implementer does not have this skill.
- Recipes were rewritten for this repository: Tailwind CSS v4 classes, Radix transform-origin variables,
  `tw-animate-css`, and the house `--ease-out` token in place of Emil's `cubic-bezier(0.23, 1, 0.32, 1)`.
  `DESIGN.md` outranks the skill where it records a motion decision.
- Removed the "Initial Response" greeting and the plan-file workflow.
