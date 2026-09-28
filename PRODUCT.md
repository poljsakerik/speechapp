# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React for the web front end, built on shadcn/ui components restyled to the MicMane brand. A component showcase page presenting every restyled shadcn component the product needs is a required deliverable alongside the pages. The existing Python pipeline (`speechapp/`) and Streamlit prototype (`app.py`) remain the review engine and are not the brand surface. Framework wrapper, routing, and deploy target are undecided.

## Users

Anyone who wants to unlock their voice: people who want to start creating content, sound more professional at work, feel more confident, or be less shy in everyday conversation. No prior course experience is assumed, and users do not pick an archetype or persona before practicing.

## Product Purpose

MicMane delivers Vinh Giang's voice course together with AI review of the user's own recordings. A user learns a foundation, records or uploads a take, receives a few timestamped, lesson-grounded suggestions, and tries another take. Success is a user expressing themselves with more choice and impact, and returning to practice, not a single score.

## Positioning

Feedback is grounded in one specific, taught method rather than generic delivery metrics: each suggestion cites a real passage in the user's recording and a principle from the lessons, and offers a concrete next-take exercise. The coach allows that a delivery can already be effective and does not manufacture faults. Whether this beats Vocal Image, Yoodli, and others is an open hypothesis (see `docs/competitive-landscape.md`), not an established claim.

## Operating Context

- Short single-speaker English recordings; the current pipeline reviews a centered one-minute excerpt of longer clips.
- Review combines Deepgram word-timed transcription, local acoustic measurements, and Mistral Voxtral listening (`speechapp/`).
- Learning loop: lesson, record, review, retake.
- Visual (body-language) review is researched (`docs/visual-review.md`) but its lessons are not yet in the repository.

## Capabilities and Constraints

- The five **foundations**, always named "foundations": Rate of speech, Volume, Pitch & melody, Tonality, Pauses (`speechapp/rubric.py`). Lesson sources live in `videos/`.
- Each foundation receives a verdict: effective, mixed, needs work, or uncertain. Findings are strengths or improvements, marked clear or tentative.
- Tonality describes perceived expression, never the speaker's actual emotion, personality, or confidence. Recorded level is not room loudness. No universal WPM, pause, or pitch thresholds.
- Model feedback is not yet validated; the blinded pilot in `docs/evaluation/pilot.md` has not been run.
- Recordings are not stored by the current prototype.
- Undecided: the relationship with Vinh Giang and his course (licensed, partnered, or independent), pricing, accounts, and persistence of practice history.

## Brand Commitments

- Name: **MicMane**.
- Logo concept: a microphone wearing a mane. Use a placeholder until the mark is designed.
- Binding identity direction from the founder: MicMane should read as a brand that exists inside the world of Cyberpunk 2077, one of the in-game companies, not as a Cyberpunk 2077 fan or game site, with no game IP, logos, or characters used.
- Founder references, recorded as given: in-game brand logos from Cyberpunk 2077 (image not yet saved to `docs/brand/references/`); an iridescent cloud as the color source, with color used sparingly the way Linear uses it on a mostly white, gray, and black canvas; one color per foundation; and a warm, glassy modern house that dares brown and orange (https://i.pinimg.com/736x/00/dc/b7/00dcb7884d3d177eb034323e5e17d212.jpg). The brand must make the user feel something and must avoid characterless contemporary minimalism.
- No brown (founder decision, 2026-09-28): the house reference's brown was tried as walnut surfaces and removed. Dark surfaces are neutral graphite; the orange glass stays as the one warm accent.

## Evidence on Hand

- Five voice lesson videos in `videos/` and principle timestamps in `speechapp/rubric.py`.
- Market research in `docs/` with sourced third-party figures (for example, Stage Academy reports 100,000+ graduates).
- No testimonials, user counts, accuracy results, pilot ratings, or competitor comparisons exist for MicMane. Do not fabricate them.
- Until the Vinh relationship is decided: no use of his likeness, no implied endorsement, and no "official" course claims.

## Product Principles

1. Ground every suggestion in the user's own passage and a taught principle; generic coaching is failure.
2. Offer choices, not verdicts on the person. Describe observable delivery; never diagnose confidence or personality.
3. Allow effective delivery to stand. Saying there is no clear problem is a valid result.
4. The retake is the product: every review should end in a concrete next attempt.
5. Show uncertainty honestly when the model is tentative.
