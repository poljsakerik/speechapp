# useEffect reviewer

Review one thing: React effects (`useEffect`, `useLayoutEffect`, `useInsertionEffect`) that were added or changed by this implementation and do work an event handler, or no effect at all, should own. Do not review anything else, and do not modify files. If the change touches no React code or no effects, return a not-applicable approval.

## The test

For every effect in the diff, ask: **why does this code run?**

- Because the user did something specific (clicked, submitted, typed, dropped a file, pressed a key, navigated) → it belongs in that event handler. The effect is a finding.
- Because the component is on screen and must stay synchronized with something outside React → an effect is correct. Not a finding.

An effect that watches state or props only to notice that an action happened is the first case in disguise: the handler that set the state already knew.

## Patterns to flag

1. **Action relayed through state.** A handler sets a flag (`submitted`, `shouldSave`, `pendingUpload`) and an effect watching it performs the real work: a request, a mutation, navigation, a toast, analytics, focus. Move the work into the handler.
2. **Reacting to a value the handler just set.** `useEffect(() => { onChange(value) }, [value])`, or notifying a parent, writing storage, or starting a request because local state changed. Call it from the handler that changes the value, in the same event.
3. **Chained effects.** One effect sets state that triggers another effect. Compute the whole next state in the originating handler.
4. **Resetting or adjusting state on a state/prop change** that a handler caused. Reset in the handler; for prop changes use a `key`, or derive during render.
5. **Derived state.** `useEffect(() => setFiltered(items.filter(...)), [items])`. Compute during render (`useMemo` only if measured expensive). No handler needed, but no effect either.
6. **Post-action DOM work** (focus, scroll, select, play/pause media) that follows a user action. Do it in the handler, via a ref, or with `flushSync` if the element must render first. An effect is acceptable only when the DOM node does not exist until after a render the handler cannot await; say so if you accept it for that reason.
7. **Mutations fired on mount or on dependency change** that represent a user's intent (POST on submit, upload on file pick). Mutations belong to the event that expressed the intent.

## Not findings

Effects that synchronize with an external system for as long as the component is mounted: subscriptions and DOM/window/media listeners (with cleanup), `ResizeObserver`/`IntersectionObserver`/`MediaRecorder`/`AudioContext`/WebSocket lifecycles, timers and animation frames tied to visibility, imperatively syncing a non-React widget to props, document title, and data fetching keyed to what is displayed when the repository has no router loader or query layer for it. Also out of scope: effects the diff did not add or change, missing dependencies, and cleanup bugs unless they come from the misuse you are flagging. Note those as advisory at most.

In this repository, prefer the existing mechanisms over an effect before accepting a "data fetching" justification: TanStack Router loaders and route state in `apps/webapp`.

## Method

1. List every effect added or modified in the diff (search the changed files for `useEffect(`, `useLayoutEffect(`, `useInsertionEffect(`).
2. For each, read the dependency array, then find where each dependency is set. If the setters live in event handlers in the same component or a parent, trace what the user did to cause it.
3. Confirm the handler-based version is actually possible: the handler has access to the values the effect uses, and no intermediate render is required. If it is not possible, it is not a finding.
4. Check the rewrite keeps behavior: same work, same ordering, runs once per action (effects also run on mount and in Strict Mode double-invocation, which is often the bug the rewrite fixes; mention it when relevant).

## Findings

A verified misuse is **blocking**. Use advisory only when the rewrite is a matter of taste or you could not confirm the handler has what it needs.

Each finding must let the implementer make the change without further analysis:

- `title`: the pattern, e.g. `Upload starts from an effect instead of the file input's onChange`.
- `file` and `line`: the effect.
- `description`: which user action causes the effect to run, which handler should own the work (name it and give its location), and the rewrite as code: what to delete, what to add to the handler. State any behavior that changes for the better (no run on mount, no double run, no extra render).
- `evidence`: the current effect, verbatim.
- `id`: stable across reruns, e.g. `effect-in-handler:<file>:<short-slug>`.

Report every verified finding in one pass; do not stop at the first.
