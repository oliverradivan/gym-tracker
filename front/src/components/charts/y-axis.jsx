"use client";;
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChart, useChartStable, useYScale } from "./chart-context";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import { resolveReferenceDataRange } from "./reference-area-geometry";
import { normalizeYAxisId } from "./y-axis-scales";
import {
  resolveYAxisTickCount,
  Y_AXIS_DEFAULT_TICK_COUNT,
} from "./y-axis-ticks";

const Y_AXIS_POSITION_TWEEN_MS = DEFAULT_Y_DOMAIN_TWEEN_MS;

function formatLabel(value, formatLargeNumbers, formatValue) {
  if (formatValue) {
    return formatValue(value);
  }
  if (formatLargeNumbers && value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`;
  }
  return String(value);
}

function resolveTickLabelColor(tickY, axisId, yScale, referenceAreas) {
  for (const area of referenceAreas) {
    if (!area.axisLabelColor) {
      continue;
    }
    if (normalizeYAxisId(area.yAxisId) !== axisId) {
      continue;
    }
    const [low, high] = resolveReferenceDataRange(
      area.y1,
      area.y2,
      yScale.domain()
    );
    const topPixel = yScale(high) ?? 0;
    const bottomPixel = yScale(low) ?? 0;
    const bandTop = Math.min(topPixel, bottomPixel);
    const bandBottom = Math.max(topPixel, bottomPixel);
    if (tickY >= bandTop && tickY <= bandBottom) {
      return area.axisLabelColor;
    }
  }
  return undefined;
}

export function YAxis(props) {
  const { containerRef } = useChartStable();
  const [container, setContainer] = useState(null);

  useEffect(() => {
    setContainer(containerRef.current);
  }, [containerRef]);

  if (!container) {
    return null;
  }

  return <YAxisInner {...props} container={container} />;
}

const YAxisInner = memo(function YAxisInner({
  yAxisId,
  orientation = "left",
  numTicks = Y_AXIS_DEFAULT_TICK_COUNT,
  formatLargeNumbers = true,
  formatValue,
  showHoverValue = true,
  tickerHalfHeight = 12,
  container
}) {
  const { margin, referenceAreas, lines, tooltipData } = useChart();
  const yScale = useYScale(yAxisId);
  const isLeft = orientation === "left";
  const axisId = normalizeYAxisId(yAxisId);

  // Lines registered on this axis, so we know which field(s) on the hovered
  // point hold this axis's value (e.g. "actualValue" for the real series,
  // "value" for a forecast/projection point).
  const axisLines = useMemo(
    () => lines.filter((line) => normalizeYAxisId(line.yAxisId) === axisId),
    [lines, axisId]
  );

  // Mirrors XAxis's hovered-date label: a floating value pill that tracks
  // the crosshair on the y-axis, so hovering shows both the date (x-axis)
  // and the value (y-axis) of the point under the cursor.
  const hoveredEntry = useMemo(() => {
    if (!(showHoverValue && tooltipData)) {
      return null;
    }

    for (const line of axisLines) {
      const y = tooltipData.yPositions?.[line.dataKey];
      const rawValue = tooltipData.point?.[line.dataKey];
      if (y != null && Number.isFinite(y) && rawValue != null) {
        return { y, label: formatLabel(rawValue, formatLargeNumbers, formatValue) };
      }
    }

    // Fallback for point shapes that don't match any registered dataKey
    // (e.g. a forecast point exposing a bare `.value`).
    const fallbackY = Object.values(tooltipData.yPositions ?? {})[0];
    const fallbackValue = tooltipData.point?.value;
    if (fallbackY != null && Number.isFinite(fallbackY) && fallbackValue != null) {
      return { y: fallbackY, label: formatLabel(fallbackValue, formatLargeNumbers, formatValue) };
    }

    return null;
  }, [showHoverValue, tooltipData, axisLines, formatLargeNumbers, formatValue]);

  const ticks = useMemo(() => {
    const tickValues = yScale.ticks(resolveYAxisTickCount(numTicks));
    return tickValues.map((value) => {
      const y = (yScale(value) ?? 0) + margin.top;
      return {
        value,
        y,
        label: formatLabel(value, formatLargeNumbers, formatValue),
        labelColor: resolveTickLabelColor(
          y - margin.top,
          axisId,
          yScale,
          referenceAreas
        ),
      };
    });
  }, [
    yScale,
    margin.top,
    numTicks,
    formatLargeNumbers,
    formatValue,
    axisId,
    referenceAreas,
  ]);

  return createPortal(
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute top-0 bottom-0"
        style={
          isLeft
            ? { left: 0, width: margin.left }
            : { right: 0, width: margin.right }
        }
      >
        {ticks.map((tick) => {
          const distance = hoveredEntry
            ? Math.abs(tick.y - margin.top - hoveredEntry.y)
            : Number.POSITIVE_INFINITY;
          const opacity = distance < tickerHalfHeight ? 0 : 1;

          return (
            <div
              className="absolute flex items-center"
              key={tick.value}
              style={{
                top: tick.y,
                transform: "translateY(-50%)",
                opacity,
                transition: `top ${Y_AXIS_POSITION_TWEEN_MS}ms cubic-bezier(${LINE_LOADING_PULSE_EASE.join(", ")}), opacity 0.15s ease-in-out`,
                ...(isLeft
                  ? { right: 0, justifyContent: "flex-end", paddingRight: 8 }
                  : { left: 0, justifyContent: "flex-start", paddingLeft: 8 }),
              }}
            >
              <span
                className="text-chart-label text-xs"
                style={tick.labelColor ? { color: tick.labelColor } : undefined}
              >
                {tick.label}
              </span>
            </div>
          );
        })}

        {hoveredEntry && (
          <div
            className="absolute flex items-center"
            style={{
              top: hoveredEntry.y + margin.top,
              transform: "translateY(-50%)",
              ...(isLeft
                ? { right: 0, justifyContent: "flex-end", paddingRight: 8 }
                : { left: 0, justifyContent: "flex-start", paddingLeft: 8 }),
            }}
          >
            <span className="text-chart-foreground text-xs font-semibold">
              {hoveredEntry.label}
            </span>
          </div>
        )}
      </div>
    </div>,
    container
  );
});

YAxis.displayName = "YAxis";

export default YAxis;