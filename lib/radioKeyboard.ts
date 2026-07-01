import type { KeyboardEvent } from "react";

/**
 * Arrow-key roving for a `role="radiogroup"` (WAI-ARIA APG). Attach as the
 * group's onKeyDown; it moves focus AND selection to the next/previous radio.
 * RTL-aware: ArrowLeft/ArrowDown advance, ArrowRight/ArrowUp go back. Selection
 * fires via the radio's own click handler, so callers don't thread values here.
 *
 * Pair with a roving tabindex on the options (the selected — or first — radio
 * tabIndex 0, the rest -1) so the group is a single tab stop.
 */
export function moveRadioFocus(e: KeyboardEvent<HTMLDivElement>): void {
  const NEXT = ["ArrowDown", "ArrowLeft"];
  const PREV = ["ArrowUp", "ArrowRight"];
  if (![...NEXT, ...PREV].includes(e.key)) return;

  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  if (radios.length === 0) return;

  e.preventDefault();
  let i = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) i = radios.findIndex((r) => r.getAttribute("aria-checked") === "true");
  if (i < 0) i = 0;

  const dir = NEXT.includes(e.key) ? 1 : -1;
  const next = radios[(i + dir + radios.length) % radios.length];
  next.focus();
  next.click();
}
