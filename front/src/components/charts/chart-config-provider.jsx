"use client";

import { useMemo } from "react";
import { ChartConfigContext, DEFAULT_CHART_CONFIG } from "./chart-config-context";

export function ChartConfigProvider({ value, children }) {
  const merged = useMemo(() => ({
    ...DEFAULT_CHART_CONFIG,
    ...value,
  }), [value]);

  return (
    <ChartConfigContext.Provider value={merged}>
      {children}
    </ChartConfigContext.Provider>
  );
}
