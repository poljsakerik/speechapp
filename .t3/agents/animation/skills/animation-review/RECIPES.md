# Animation recipes

Implementations to put in findings. Each recipe is given the way this repository writes it (Tailwind CSS v4 classes, Radix primitives, `tw-animate-css`), followed by plain CSS for cases where a class string does not fit. Adapt names and selectors to the code in front of you, keep the values.

`--ease-out` is the repository's house easing, `cubic-bezier(0.16, 1, 0.3, 1)`, defined in `packages/ui/src/styles/globals.css`. In classes it is `ease-(--ease-out)`.

When you hand a recipe to the implementer, include the reduced-motion line and the "do not" list. They are part of the recipe.

## Picking the tool

Walk down and stop at the first that fits.

| Need | Tool |
| --- | --- |
| Hover, press, color, a state you control with a class or attribute | CSS transition |
| Entry on mount, no JS state | `@starting-style` (Tailwind `starting:`) |
| Enter and exit of a Radix overlay | `tw-animate-css` utilities on `data-open:` / `data-closed:` |
| Predetermined motion that must stay smooth while the page is busy | CSS animation (runs off the main thread) |
| Programmatic control without a dependency | Web Animations API |
| Springs, layout animation, gesture-driven values | A motion library. Not installed here; see Drag and gestures |

If the request is really for a component (toast, drawer, command menu, dropdown), the answer is the existing primitive in `packages/ui/src/components`, not a hand-rolled animated `div`.

---

## Press feedback

Any pressable element. Confirms the interface heard the user.

```
transition-transform duration-150 ease-(--ease-out) active:scale-[0.97]
```

If the element already has a transition list, add `transform` to it rather than adding a second `transition` class:

```
transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-(--ease-out) active:scale-[0.97]
```

```css
.button { transition: transform 160ms var(--ease-out); }
.button:active { transform: scale(0.97); }
```

- Scale between 0.95 and 0.98. Duration 100 to 160ms; 200ms is acceptable when it shares the control's existing transition.
- `:active` is a real press on touch, so it needs no hover gating.
- Reduced motion: keep it. A 3% scale is feedback, not travel. If the control also shifts position on press, drop the shift: `motion-reduce:active:translate-y-0`.
- Do not: scale below 0.95, add a bounce, animate on `:hover`, or add press feedback to an element that already has it through the shared `Button`.

Check the shared `Button` first. If the new control should have been a `Button`, the finding is "use `Button`", not "add press feedback".

---

## Enter on mount

Content that appears because of something the user did: a result, a banner, a revealed section. No JS, no mount flag.

```
transition-[opacity,transform] duration-200 ease-(--ease-out)
starting:opacity-0 starting:translate-y-1
motion-reduce:starting:translate-y-0
```

```css
.panel {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);

  @starting-style {
    opacity: 0;
    transform: translateY(4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .panel { @starting-style { transform: none; } }
}
```

- Offset 4 to 8px, in the direction the content logically comes from. Or scale: `starting:scale-[0.97]` instead of translate, for a surface that appears in place.
- Never both a large translate and a scale. Pick one.
- Do not: use `useEffect(() => setMounted(true), [])` to trigger it. That is the legacy fallback for browsers without `@starting-style` and costs a render. Do not animate the children separately.

---

## Exit animations

An element removed from the React tree is gone on the next frame, so it cannot transition out. Three options, in order of preference:

1. **Enter only.** Most content does not need an exit. A result that is replaced, a banner that is dismissed: let it go instantly. Say so in the finding so the implementer does not build one.
2. **Radix overlays.** Radix keeps content mounted until its exit *keyframe animation* ends. That is why overlays here use `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95`. Radix waits for CSS animations, not transitions, so an exit on Radix content must be an animation utility.
3. **Keep it mounted and toggle visibility.** For a non-Radix element that needs a real exit, render it always and switch a state attribute. `transition-discrete` lets `display` take part in the transition:

```
hidden data-[open=true]:block
transition-[opacity,transform,display] transition-discrete duration-200 ease-(--ease-out)
opacity-0 translate-y-1 data-[open=true]:opacity-100 data-[open=true]:translate-y-0
starting:data-[open=true]:opacity-0 starting:data-[open=true]:translate-y-1
```

A closed element kept in the tree must not be focusable or announced: `hidden` handles both.

Exit rules: the same path as the entrance, reversed. Exits may be slightly faster than entrances (150ms against 200ms). Never slower.

---

## Popover, dropdown, menu, select

Scales out of its trigger, not out of thin air.

```
origin-(--radix-popover-content-transform-origin)
duration-200 ease-(--ease-out)
data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
```

The variable is named for the primitive: `--radix-popover-content-transform-origin`, `--radix-dropdown-menu-content-transform-origin`, `--radix-select-content-transform-origin`, `--radix-hover-card-content-transform-origin`, `--radix-context-menu-content-transform-origin`, `--radix-tooltip-content-transform-origin`.

```css
.popover {
  transform-origin: var(--radix-popover-content-transform-origin);
  animation-duration: 200ms;
  animation-timing-function: var(--ease-out);
}
```

- The origin is the whole point: the panel should look like it came out of the thing that was clicked. A missing `origin-(...)` class means it scales from its center, which is the most common defect.
- Duration 150 to 250ms. Scale from 0.95.
- Reduced motion: drop the zoom, keep the fade: `motion-reduce:data-open:zoom-in-100 motion-reduce:data-closed:zoom-out-100`.
- Follow `packages/ui/src/components/popover.tsx`.
- Do not: add a slide and a zoom together on a small menu; exceed 250ms; animate a menu opened by a keyboard shortcut.

---

## Tooltip

The same shape as a popover, faster.

```
origin-(--radix-tooltip-content-transform-origin)
duration-150 ease-(--ease-out)
data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
```

- Duration 125 to 200ms, scale from 0.97 or 0.95.
- The detail most implementations miss: the first tooltip waits (the delay prevents accidental activation), but once one is open, neighbours open with no delay and no animation. With Radix, wrap the group in one `TooltipProvider` and set `skipDelayDuration` (300ms is the Radix default) so moving between adjacent triggers skips the delay. If a toolbar gives each tooltip its own provider, that is the finding.
- Follow `packages/ui/src/components/tooltip.tsx`.

---

## Dialog

The one overlay that stays centered. It is not anchored to a trigger, so `transform-origin: center` is correct. Do not report it.

```
duration-200 ease-(--ease-out)
data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95
```

Overlay (backdrop): `duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0`.

- 200 to 250ms. Scale from 0.95 or 0.96.
- Animate the backdrop's opacity for the same duration so the two read as one surface.
- Follow `packages/ui/src/components/dialog.tsx`.

---

## Sheet and drawer

```
transition duration-300 ease-(--ease-out)
data-[side=bottom]:data-open:slide-in-from-bottom data-[side=bottom]:data-closed:slide-out-to-bottom
```

```css
.drawer { transform: translateY(0); transition: transform 300ms var(--ease-out); }
.drawer[data-closed] { transform: translateY(100%); }
```

- 200 to 500ms; larger surfaces may take longer. This repository's sheet uses 300ms.
- Translate by percentage so it works at any height.
- Exits through the edge it entered from.
- Reduced motion: replace the slide with a fade.
- Follow `packages/ui/src/components/sheet.tsx`.
- Adding drag-to-dismiss makes it a gesture problem; see Drag and gestures.

---

## Toast

Use `sonner` through `packages/ui/src/components/sonner.tsx`. Do not hand-roll a toast or override Sonner's motion: its timing (`ease`, about 400ms, slightly slower than typical UI) is tuned to the component and is part of why it feels right. A finding here is almost always "call `toast()` instead of building a banner."

If a custom transient notice is unavoidable: transitions, not keyframes, because notices stack rapidly; enter and exit by the same edge; `translateY(100%)`, not pixels.

---

## Accordion and collapse

```
overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up
```

Use the shared `Accordion` (`packages/ui/src/components/accordion.tsx`) or Radix `Collapsible`, which supply the measured height as `--radix-accordion-content-height` / `--radix-collapsible-content-height`.

For a non-Radix collapse, animate grid rows instead of measuring height:

```
grid transition-[grid-template-rows,opacity] duration-200 ease-(--ease-out)
grid-rows-[0fr] opacity-0 data-[open=true]:grid-rows-[1fr] data-[open=true]:opacity-100
```

with the content in a single child that has `overflow-hidden min-h-0`.

- Keep it near 200ms. This is one of the few animations that costs layout on every frame, so a long duration is expensive as well as sluggish.
- Never animate `height` to `auto`.
- Reduced motion: drop the height change, keep the opacity fade.
- When opacity and height animate together on list items, the balance is trial and error. There is no formula; give a feel check.

---

## List item enter

For a list that grows occasionally because of a user action (a note added, a take saved). Not for a list the user scrolls past all day, and not for the initial render.

```
transition-[opacity,transform] duration-200 ease-(--ease-out)
starting:opacity-0 starting:-translate-y-1
motion-reduce:starting:translate-y-0
```

- Enter from the direction new items arrive (top for prepend, bottom for append).
- Use transitions so several items added quickly each retarget smoothly.
- Removal: let it be instant unless the list is short and the removal is the user's own deliberate action; then use option 3 in Exit animations.
- Do not: animate reordering without a layout-animation tool; animate the initial render of the list (that is Stagger, and has its own gate).

---

## Stagger

For a group seen occasionally: a results grid arriving, an empty state resolving, a first-run screen. Not for anything scrolled past daily.

```tsx
{items.map((item, i) => (
  <li
    key={item.id}
    style={{ transitionDelay: `${Math.min(i, 6) * 50}ms` }}
    className="transition-[opacity,transform] duration-300 ease-(--ease-out) starting:opacity-0 starting:translate-y-2 motion-reduce:starting:translate-y-0 motion-reduce:delay-0!"
  />
))}
```

```css
.item { opacity: 0; transform: translateY(8px); animation: fadeIn 300ms var(--ease-out) forwards; }
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }
@keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
```

- 30 to 80ms between items. Longer feels slow.
- Cap the total: stop increasing the delay after 6 or so items so a long list does not take a second to finish.
- Stagger is decorative. It must never block interaction: no `pointer-events-none` during it, and the items must be usable before it completes.
- Reduced motion: no delay and no movement; a plain fade.
- The transition delay must not persist into later interactions (a delayed hover). Scope the delay to the entrance or clear it after.

---

## Crossfade between states

When content swaps in place (a label changing, a button moving between idle, loading, and done) and a plain swap looks like a flicker.

First try a plain 150 to 200ms opacity transition. If two overlapping states are visibly double-exposed during it, and no easing or duration tuning fixes it, mask the seam with a small blur:

```css
.content { transition: filter 200ms ease, opacity 200ms ease; }
.content.transitioning { filter: blur(2px); opacity: 0.7; }
```

Without blur the eye reads two objects swapping. Blur blends them into one perceived transformation.

- Blur at 2px. Never 20px or more; heavy blur is expensive, especially in Safari.
- Numbers that change in place need `tabular-nums` (the repo's `tabular` utility) so digits do not shift width. That is not an animation, and it matters more than one.
- Do not animate a value the user is reading while it is still changing (a live level meter, a running timer).

---

## Hold to confirm

For a destructive action where a single click is too easy to fire by accident and the cost is real (deleting a recording).

```css
.overlay {
  clip-path: inset(0 100% 0 0);
  transition: clip-path 200ms var(--ease-out);   /* release: snappy */
}
.button:active .overlay {
  clip-path: inset(0 0 0 0);
  transition: clip-path 2s linear;               /* press: slow and deliberate */
}
.button:active { transform: scale(0.97); }
```

- `linear` is correct for the fill: it is a progress indicator and progress should not ease.
- The asymmetry is the pattern: slow where the user is deciding, fast where the system responds.
- `clip-path: inset(top right bottom left)`: each value eats in from that side. It is hardware accelerated and needs no extra layout.
- The action must fire when the fill completes, from `transitionend` on the overlay or a matching timer cleared on release. Specify which, and specify the keyboard path: holding Enter or Space must work, or provide a confirm dialog fallback.
- Reduced motion: keep the fill (it is information), drop the scale.

---

## Tab indicator

Timing separate color transitions across a tab list never quite lands. Clip instead.

Duplicate the tab list. Style the copy as the active state (different background and text color). Clip the copy so only the active tab shows, and animate the clip when the tab changes:

```css
.tabs-active-copy {
  clip-path: inset(0 60% 0 20%);   /* computed from the active tab's position */
  transition: clip-path 250ms var(--ease-out);
}
```

Text and background change in perfect sync because they are one element being revealed, not two colors being interpolated. The copy is `aria-hidden` and `pointer-events-none`.

This is polish. Request it as advisory, and only where the existing `Tabs` indicator visibly mistimes.

---

## Scroll reveal

Marketing surfaces only. Never on functional UI a user visits daily.

```css
.reveal { clip-path: inset(0 0 100% 0); transition: clip-path 600ms var(--ease-out); }
.reveal[data-visible] { clip-path: inset(0 0 0 0); }
```

Trigger with `IntersectionObserver` and fire it once (`observer.unobserve` after the first intersection, with a root margin of about `-100px`). Re-animating on every scroll-by is an interface fighting its reader.

Reduced motion: show the content immediately.

---

## Programmatic, without a library

When motion needs JS control (triggered from a handler, values computed at runtime) but not a dependency:

```js
element.animate(
  [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }],
  { duration: 300, fill: "forwards", easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
)
```

Hardware accelerated, interruptible, no bundle cost. Check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` before calling it and skip or shorten accordingly.

---

## Drag and gestures

The values users feel most and implementers get wrong most. Request these only when the change builds a drag, swipe, scrub, or slider interaction.

**Respond immediately and continuously**

- Show feedback on pointer-down, not on release.
- While dragging, move the element 1:1 with the pointer for the whole gesture. Never animate only when the gesture ends.
- Respect where the user grabbed: keep the offset between pointer and element. Snapping the element's center to the pointer breaks the illusion.
- Require about 10px of movement before committing to a drag direction, then track 1:1.

**Mechanics**

- `element.setPointerCapture(event.pointerId)` on pointer-down, so the drag continues when the pointer leaves the element.
- Ignore additional pointers once a drag has started (`if (isDragging) return`), or switching fingers makes the element jump.
- Write the transform directly: `element.style.transform = \`translateY(${distance}px)\``. Do not set a CSS variable on a parent (recalculates every child) and do not put the position in React state (re-renders every frame).
- Keep the last few pointer positions and timestamps; velocity at release is needed.

**Releasing**

- Dismiss on a flick, not only on distance:

```js
const velocity = Math.abs(distance) / elapsedMs
if (Math.abs(distance) >= THRESHOLD || velocity > 0.11) dismiss()
```

- Settle with a spring that starts at the release velocity, so there is no seam between dragging and animating. No bounce unless the gesture carried momentum: `{ type: "spring", duration: 0.4, bounce: 0 }`; after a flick, `{ type: "spring", duration: 0.5, bounce: 0.2 }`.
- Choose the snap target from where the gesture is going, not where it was released:

```js
// decelerationRate 0.998 for a normal scroll feel, 0.99 for snappier
const project = (velocityPxPerSec, rate = 0.998) => (velocityPxPerSec / 1000) * rate / (1 - rate)
const target = nearestSnapPoint(position + project(releaseVelocity))
```

- A moving element must be grabbable mid-flight and follow the pointer from its current on-screen position, not from its target. Never lock input during a transition.

**Boundaries**

- Past a natural edge, resist progressively; do not stop dead. A hard stop reads as frozen.

```js
const rubberband = (overshoot, dimension, c = 0.55) =>
  (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot))
```

**Dependency**

Without a motion library, velocity-carrying springs must be hand-written. If the change builds a real drag-to-dismiss, the honest spec is either a CSS transition back to rest (acceptable, state the loss: it cannot be grabbed mid-flight) or adding `motion` (state the dependency and mark it advisory). Do not ask the implementer to write a spring solver.

With `motion`, animate the full transform string, not the shorthands: `animate={{ transform: "translateX(100px)" }}` is hardware accelerated; `animate={{ x: 100 }}` runs on the main thread and drops frames under load.

**Reduced motion**

Dragging itself is direct manipulation and stays. Replace the settle spring with a short opacity fade or an instant snap.

---

## Vocabulary

Use these exact terms in findings so the implementer can search for them.

- **Scale in**: grows from slightly smaller to full size as it appears, usually with a fade.
- **Pop in**: appears with a slight overshoot. Rarely right in this product.
- **Origin-aware**: animates out of its trigger instead of its own center.
- **Crossfade**: one element fades out as another fades in, in the same spot.
- **Reveal**: content uncovered gradually by animating a clip-path or mask.
- **Stagger**: several items animated one after another with a small delay between each.
- **Press feedback**: a subtle scale-down while an element is pressed.
- **Hold to confirm**: a progress fill that completes while the user holds a button.
- **Layout animation**: an element whose size or position changes animates to the new spot instead of snapping. Needs a library or the View Transitions API.
- **Direction-aware transition**: content slides one way going forward and the opposite way going back.
- **Rubber-banding**: resistance and snap-back when dragging past a boundary.
- **Interruptible**: can be smoothly redirected mid-flight instead of finishing first.
- **Tabular numbers**: fixed-width digits so changing numbers do not shift.
- **Jank**: visible stutter from dropped frames. **Layout thrashing**: animating properties that force layout every frame.
