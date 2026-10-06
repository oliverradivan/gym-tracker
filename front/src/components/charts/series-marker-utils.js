export function getSeriesMarkerVisualExtent(style) {
  const radius = style.radius ?? 5;
  const strokeWidth = style.strokeWidth ?? 2;
  const ringGap = style.ringGap ?? 2;
  const outlineWidth = style.outlineWidth ?? 0;
  const showActiveHighlight = style.showActiveHighlight ?? true;
  const ring = strokeWidth > 0 ? ringGap + strokeWidth : 0;
  const outline = outlineWidth > 0 ? outlineWidth : 0;
  const highlightPad = showActiveHighlight ? radius * 0.35 : 0;
  return radius + ring + outline + highlightPad + 2;
}
