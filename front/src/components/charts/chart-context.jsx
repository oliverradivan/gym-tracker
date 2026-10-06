"use client";;
import { useContext } from "react";
import { DEFAULT_Y_AXIS_ID } from "./y-axis-scales";
import { ChartHoverContext, ChartStableContext } from "./chart-contexts";

// CSS variable references for theming
export const chartCssVars = {
  background: "var(--chart-background)",
  foreground: "var(--chart-foreground)",
  foregroundMuted: "var(--chart-foreground-muted)",
  label: "var(--chart-label)",
  linePrimary: "var(--chart-line-primary)",
  lineSecondary: "var(--chart-line-secondary)",
  crosshair: "var(--chart-crosshair)",
  grid: "var(--chart-grid)",
  indicatorColor: "var(--chart-indicator-color)",
  indicatorSecondaryColor: "var(--chart-indicator-secondary-color)",
  markerBackground: "var(--chart-marker-background)",
  markerBorder: "var(--chart-marker-border)",
  markerForeground: "var(--chart-marker-foreground)",
  badgeBackground: "var(--chart-marker-badge-background)",
  badgeForeground: "var(--chart-marker-badge-foreground)",
  segmentBackground: "var(--chart-segment-background)",
  segmentLine: "var(--chart-segment-line)",
  brushBorder: "var(--chart-brush-border)",
  tooltipBackground: "var(--chart-tooltip-background)",
};

/** Default scatter series colors from the chart palette (`--chart-1` … `--chart-5`). */
export const defaultScatterColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)"
];

/**
 * Splits the merged `value` into a stable slice and a volatile hover slice,
 * publishing each to its own context. Each slice is memoized on its own
 * field identities, so changing `tooltipData` does not bust the stable
 * slice — consumers of `useChartStable()` skip re-renders on hover.
 */
/**
 * Stable slice — data, scales, dimensions, animation state, layout config.
 * Subscribers skip re-renders on hover (the hover slice lives in a separate
 * context). Prefer this in cold consumers like axes, grid, pattern fills.
 */
export function useChartStable() {
  const context = useContext(ChartStableContext);
  if (!context) {
    throw new Error(
      "useChartStable must be used within a ChartProvider. " +
        "Make sure your component is wrapped in <LineChart>, <AreaChart>, <BarChart>, or <ComposedChart>."
    );
  }
  return context;
}

/** Y-scale for a series axis (`yAxisId` on Line / Area / YAxis). */
export function useYScale(yAxisId) {
  const { yScales, yScale } = useChartStable();
  const id =
    yAxisId == null || yAxisId === "" ? DEFAULT_Y_AXIS_ID : String(yAxisId);
  return yScales[id] ?? yScale;
}

/**
 * Hover slice — tooltipData, selection, hovered bar / candle indices.
 * Subscribers re-render on every mouse move. Use only when the component
 * actually reads hover state.
 */
export function useChartHover() {
  const context = useContext(ChartHoverContext);
  if (!context) {
    throw new Error(
      "useChartHover must be used within a ChartProvider. " +
        "Make sure your component is wrapped in <LineChart>, <AreaChart>, <BarChart>, or <ComposedChart>."
    );
  }
  return context;
}

/**
 * Merged stable + hover context. Convenient for components that need both,
 * but re-renders on every hover (because hover changes). Prefer
 * `useChartStable()` or `useChartHover()` for hot consumers that only need
 * one slice.
 */
export function useChart() {
  const stable = useChartStable();
  const hover = useChartHover();
  // Identity changes on every hover (hover is the volatile slice) — that's
  // fine for consumers using this merged hook; they explicitly opted in to
  // re-rendering on hover.
  return { ...stable, ...hover };
}
