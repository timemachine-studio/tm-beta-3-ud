/* The app pages render at 80% (index.css: body { zoom }) so the product sits
   at the density the chat was designed at; the marketing pages stay at 1.
   CSS zoom relays out in "zoomed pixels", but pointer events and
   getBoundingClientRect() still speak real viewport pixels — so anything that
   positions a fixed element from those has to divide by the zoom first. */

export function pageZoom(): number {
  if (typeof document === 'undefined') return 1;
  const z = parseFloat(getComputedStyle(document.body).zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** A real viewport pixel measure, as the length a zoomed layout needs. */
export function toLayoutPx(n: number): number {
  return n / pageZoom();
}
