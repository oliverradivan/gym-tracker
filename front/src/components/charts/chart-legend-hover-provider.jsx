"use client";

import { useMemo } from "react";
import { ChartLegendHoverContext } from "./chart-legend-hover";

export function ChartLegendHoverProvider({
  hoveredIndex,
  onHoverChange,
  children
}) {
  const value = useMemo(
    () => ({ hoveredIndex, setHoveredIndex: onHoverChange }),
    [hoveredIndex, onHoverChange]
  );

  return (
    <ChartLegendHoverContext.Provider value={value}>
      {children}
    </ChartLegendHoverContext.Provider>
  );
}
