"use client";

import { StaticChartPreviewContext } from "./static-chart-preview-context";

/** Disables cartesian reveal clip-path for static docs previews. */
export function StaticChartPreviewProvider({ children }) {
  return (
    <StaticChartPreviewContext.Provider value={true}>
      {children}
    </StaticChartPreviewContext.Provider>
  );
}
