"use client";;
import { createContext, useContext } from "react";

export const ChartLegendHoverContext = createContext(null);

export function useChartLegendHover() {
  const context = useContext(ChartLegendHoverContext);
  return (
    context ?? {
      hoveredIndex: null,
      setHoveredIndex: () => {
        /* noop outside ChartLegendHoverProvider */
      },
    }
  );
}
