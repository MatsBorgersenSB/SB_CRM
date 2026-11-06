"use client";

import { useState } from "react";

const UNSET: unique symbol = Symbol("unset");

/**
 * Run `onChange` when any value in `deps` changes (and, by default, on first render).
 *
 * Use this to react to a parent prop — for example a "request counter" that asks a
 * panel to open, or a record id that should reset a form — by adjusting this
 * component's own state *during render*, which is React's recommended alternative to
 * calling `setState` inside an effect.
 *
 * - `onChange` must only update this component's own state.
 * - Pass `{ runOnMount: false }` to behave like "when this prop changes after mount".
 * - `deps` should be primitives or stable references (same rules as `useEffect`).
 */
export function useWhenChanged(
  deps: readonly unknown[],
  onChange: () => void,
  { runOnMount = true }: { runOnMount?: boolean } = {},
) {
  const [prev, setPrev] = useState<readonly unknown[] | typeof UNSET>(() =>
    runOnMount ? UNSET : deps,
  );
  const changed =
    prev === UNSET ||
    prev.length !== deps.length ||
    deps.some((value, index) => !Object.is(value, prev[index]));
  if (changed) {
    setPrev(deps);
    onChange();
  }
}
