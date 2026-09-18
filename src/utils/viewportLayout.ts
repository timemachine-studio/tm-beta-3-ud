interface ViewportMeasurement {
  layoutHeight: number;
  visualHeight: number;
  offsetTop: number;
  scale: number;
  zoom: number;
  focused: boolean;
}

export function viewportLayout({ layoutHeight, visualHeight, offsetTop, scale, zoom, focused }: ViewportMeasurement) {
  const occluded = Math.max(0, layoutHeight - visualHeight - offsetTop);
  // Browser chrome and pinch zoom are not keyboards. After blur, prefer CSS
  // dynamic viewport units over a potentially stale visualViewport snapshot.
  const keyboardOpen = focused && scale <= 1.01 && occluded > 80;
  return {
    vh: keyboardOpen ? `${visualHeight / zoom / 100}px` : `calc(1dvh / ${zoom})`,
    keyboard: keyboardOpen ? occluded / zoom : 0,
  };
}
