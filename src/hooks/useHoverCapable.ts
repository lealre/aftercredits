import { useEffect, useState } from "react";

/**
 * Whether this device has a pointer that can genuinely hover.
 *
 * `(hover: hover) and (pointer: fine)` rather than a width breakpoint: width
 * says nothing about the input device. A touchscreen laptop is wide and cannot
 * hover usefully; a phone in landscape is not narrow. Asking about the pointer
 * asks the actual question.
 *
 * Starts false so a touch device never flashes hover behaviour on first paint,
 * and because matchMedia is absent in a non-browser environment.
 */
export function useHoverCapable(): boolean {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    setCanHover(query.matches);

    // Plugging in a mouse, or a tablet switching to a trackpad case, changes
    // the answer while the page is open.
    const onChange = (e: MediaQueryListEvent) => setCanHover(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return canHover;
}
