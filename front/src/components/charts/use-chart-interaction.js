"use client";;
import { localPoint } from "@visx/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScheduledTooltip } from "./use-scheduled-tooltip";
import { DEFAULT_Y_AXIS_ID, normalizeYAxisId } from "./y-axis-scales";
import { projectionDateExtents, projectionValueExtents } from "./projection-utils";

export function useChartInteraction(
  {
    xScale,
    yScale,
    yScales,
    data,
    lines,
    margin,
    xAccessor,
    bisectDate,
    canInteract,
    projectionConfigs
  }
) {
  const [selection, setSelection] = useState(null);
  const {
    tooltipData,
    setTooltipData,
    scheduleTooltip,
    clearTooltip,
    resetTooltipDedupe,
  } = useScheduledTooltip();

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const lastHoveredXRef = useRef(null);

  const resolveTooltipFromX = useCallback(
    pixelX => {
      const x0 = xScale.invert(pixelX);

      // Build a combined data array that includes both actual points and
      // forecast/projection points, tagged with their type for hit-testing.
      // This allows the crosshair to work continuously across both lines.
      const combinedData = buildCombinedData(data, projectionConfigs, xAccessor);

      // If there's no combined data, fall back to the original behavior.
      if (!combinedData || combinedData.length === 0) {
        const index = bisectDate(data, x0, 1);
        const d0 = data[index - 1];
        const d1 = data[index];

        if (!d0) {
          return null;
        }

        let d = d0;
        let finalIndex = index - 1;
        if (d1) {
          const d0Time = xAccessor(d0).getTime();
          const d1Time = xAccessor(d1).getTime();
          if (x0.getTime() - d0Time > d1Time - x0.getTime()) {
            d = d1;
            finalIndex = index;
          }
        }

        const yPositions = {};
        for (const line of lines) {
          const value = d[line.dataKey];
          if (typeof value === "number") {
            const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? yScale;
            yPositions[line.dataKey] = axisScale(value) ?? 0;
          }
        }

        return {
          point: d,
          index: finalIndex,
          x: xScale(xAccessor(d)) ?? 0,
          yPositions,
          pointType: "actual",
        };
      }

      // Find the index in the combined data nearest to x0.
      // Since combinedData is sorted (actuals first, then forecast), we can
      // use a simple linear search or binary search. We'll use bisect on the
      // x values of the combined data.
      const combinedXValues = combinedData.map(d => xAccessor(d).getTime());
      const index = bisectDate(combinedData, x0, 1);
      const d0 = combinedData[index - 1];
      const d1 = combinedData[index];

      if (!d0) {
        return null;
      }

      let d = d0;
      let finalIndex = index - 1;
      let pointType = "actual";

      if (d1) {
        const d0Time = xAccessor(d0).getTime();
        const d1Time = xAccessor(d1).getTime();
        if (x0.getTime() - d0Time > d1Time - x0.getTime()) {
          d = d1;
          finalIndex = index;
          pointType = d1.type ?? "actual";
        }
      } else {
        pointType = d0.type ?? "actual";
      }

      // Compute yPositions for all lines (actual + forecast)
      const yPositions = {};
      // First, compute y-positions for actual-line dataKeys using the
      // existing loop (works because actual data points have dataKey properties).
      for (const line of lines) {
        const value = d[line.dataKey];
        if (typeof value === "number") {
          const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? yScale;
          yPositions[line.dataKey] = axisScale(value) ?? 0;
        }
      }

      // If this is a forecast point, also compute y-position from the
      // forecast point's `.value` using the projection's yAxisId (if any),
      // falling back to the default yScale. This ensures the on-chart marker
      // dot appears at the correct vertical position when hovering over
      // the forecast line.
      if (pointType === "forecast") {
        // Find the projection config that matches the first line's yAxisId,
        // or use the default scale.
        let forecastAxisId = DEFAULT_Y_AXIS_ID;
        if (lines.length > 0 && lines[0]?.yAxisId) {
          forecastAxisId = lines[0].yAxisId;
        } else {
          // Check if any line has a yAxisId
          for (const line of lines) {
            if (line.yAxisId) {
              forecastAxisId = line.yAxisId;
              break;
            }
          }
        }
        const forecastScale = yScales[normalizeYAxisId(forecastAxisId)] ?? yScale;
        const forecastValue = typeof d.value === "number" ? d.value : 0;
        yPositions[forecastAxisId] = forecastScale(forecastValue) ?? 0;
        // Also set it under the first line's dataKey so the marker-rendering
        // code (which reads yPositions[line.dataKey]) can find it.
        if (lines.length > 0) {
          yPositions[lines[0].dataKey] = forecastScale(forecastValue) ?? 0;
        }
      }

      return {
        point: d,
        index: finalIndex,
        x: xScale(xAccessor(d)) ?? 0,
        yPositions,
        pointType,
      };
    },
    [xScale, yScale, yScales, data, lines, xAccessor, bisectDate, projectionConfigs, normalizeYAxisId]
  );

  const resolveIndexFromX = useCallback(
    pixelX => {
      const x0 = xScale.invert(pixelX);
      const index = bisectDate(data, x0, 1);
      const d0 = data[index - 1];
      const d1 = data[index];
      if (!d0) {
        return 0;
      }
      if (d1) {
        const d0Time = xAccessor(d0).getTime();
        const d1Time = xAccessor(d1).getTime();
        if (x0.getTime() - d0Time > d1Time - x0.getTime()) {
          return index;
        }
      }
      return index - 1;
    },
    [xScale, data, xAccessor, bisectDate]
  );

  const getChartX = useCallback(
    (event, touchIndex = 0) => {
      let point;

      if ("touches" in event) {
        const touch = event.touches[touchIndex];
        if (!touch) {
          return null;
        }
        const svg = event.currentTarget.ownerSVGElement;
        if (!svg) {
          return null;
        }
        point = localPoint(svg, touch);
      } else {
        point = localPoint(event);
      }

      if (!point) {
        return null;
      }
      return point.x - margin.left;
    },
    [margin.left]
  );

  const handleMouseMove = useCallback(
    (event) => {
      const chartX = getChartX(event);
      if (chartX === null) {
        return;
      }

      if (isDraggingRef.current) {
        const startX = Math.min(dragStartXRef.current, chartX);
        const endX = Math.max(dragStartXRef.current, chartX);
        setSelection({
          startX,
          endX,
          startIndex: resolveIndexFromX(startX),
          endIndex: resolveIndexFromX(endX),
          active: true,
        });
        return;
      }

      lastHoveredXRef.current = chartX;
      const tooltip = resolveTooltipFromX(chartX);
      if (tooltip) {
        scheduleTooltip(tooltip);
      }
    },
    [getChartX, resolveTooltipFromX, resolveIndexFromX, scheduleTooltip]
  );

  const handleMouseLeave = useCallback(() => {
    lastHoveredXRef.current = null;
    clearTooltip();
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
    setSelection(null);
  }, [clearTooltip]);

  const handleMouseDown = useCallback(
    (event) => {
      const chartX = getChartX(event);
      if (chartX === null) {
        return;
      }
      isDraggingRef.current = true;
      dragStartXRef.current = chartX;
      clearTooltip();
      setSelection(null);
    },
    [getChartX, clearTooltip]
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
    setSelection(null);
  }, []);

  const handleTouchStart = useCallback(
    (event) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        lastHoveredXRef.current = chartX;
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          scheduleTooltip(tooltip);
        }
      } else if (event.touches.length === 2) {
        event.preventDefault();
        resetTooltipDedupe();
        clearTooltip();
        const x0 = getChartX(event, 0);
        const x1 = getChartX(event, 1);
        if (x0 === null || x1 === null) {
          return;
        }
        const startX = Math.min(x0, x1);
        const endX = Math.max(x0, x1);
        setSelection({
          startX,
          endX,
          startIndex: resolveIndexFromX(startX),
          endIndex: resolveIndexFromX(endX),
          active: true,
        });
      }
    },
    [
      getChartX,
      resolveTooltipFromX,
      resolveIndexFromX,
      scheduleTooltip,
      resetTooltipDedupe,
      clearTooltip,
    ]
  );

  const handleTouchMove = useCallback(
    (event) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const chartX = getChartX(event, 0);
        if (chartX === null) {
          return;
        }
        lastHoveredXRef.current = chartX;
        const tooltip = resolveTooltipFromX(chartX);
        if (tooltip) {
          scheduleTooltip(tooltip);
        }
      } else if (event.touches.length === 2) {
        event.preventDefault();
        const x0 = getChartX(event, 0);
        const x1 = getChartX(event, 1);
        if (x0 === null || x1 === null) {
          return;
        }
        const startX = Math.min(x0, x1);
        const endX = Math.max(x0, x1);
        setSelection({
          startX,
          endX,
          startIndex: resolveIndexFromX(startX),
          endIndex: resolveIndexFromX(endX),
          active: true,
        });
      }
    },
    [getChartX, resolveTooltipFromX, resolveIndexFromX, scheduleTooltip]
  );

  const handleTouchEnd = useCallback(() => {
    clearTooltip();
    setSelection(null);
  }, [clearTooltip]);

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  // Re-anchor tooltip/crosshair when x-scale or visible data changes (e.g. brush zoom commit).
  useEffect(() => {
    if (!canInteract || lastHoveredXRef.current === null) {
      return;
    }
    const tooltip = resolveTooltipFromX(lastHoveredXRef.current);
    if (tooltip) {
      scheduleTooltip(tooltip, `${tooltip.index}:${Math.round(tooltip.x)}`);
      return;
    }
    clearTooltip();
  }, [canInteract, clearTooltip, resolveTooltipFromX, scheduleTooltip]);

  const interactionHandlers = canInteract
    ? {
        onMouseMove: handleMouseMove,
        onMouseLeave: handleMouseLeave,
        onMouseDown: handleMouseDown,
        onMouseUp: handleMouseUp,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
      }
    : {};

  const interactionStyle = {
    cursor: canInteract ? "crosshair" : "default",
    touchAction: "none",
  };

  return {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    interactionStyle,
  };
};

/**
 * Build a combined data array that merges actual data points with forecast/projection points.
 * Actual points come first, tagged with type: "actual", and forecast points come after,
 * tagged with type: "forecast". This is used for hit-testing so the crosshair can
 * snap continuously across both the actual line and the projection line.
 *
 * The y-domain is NOT widened by this merge — only the data used for hit-testing.
 */
function buildCombinedData(actualData, projectionConfigs, xAccessor) {
  if (!projectionConfigs || projectionConfigs.length === 0) {
    // No forecast data — no merge needed, return null to keep original behavior.
    return null;
  }

  // Collect actual data points (these are already in actualData)
  const actualPoints = actualData || [];

  // Collect forecast points from all projection configs.
  // Each config has a `data` array of { date, value } points and a `yAxisId`.
  // We map them to the same shape as actual data points: { date, value, ... }.
  // We tag each forecast point with type: "forecast".
  const forecastPoints = [];
  for (const config of projectionConfigs) {
    const configData = config.data;
    if (!configData || configData.length === 0) {
      continue;
    }
    for (const point of configData) {
      // Normalize the point shape — projection data uses { date, value }
      const date = point.date instanceof Date ? point.date : new Date(point.date);
      const value = typeof point.value === "number" ? point.value : null;
      if (date && value != null) {
        forecastPoints.push({
          date,
          value,
          type: "forecast",
        });
      }
    }
  }

  if (forecastPoints.length === 0) {
    return null;
  }

  // Deduplicate forecast points against actual points by date timestamp
  const actualDates = new Set(actualPoints.map((d) => xAccessor(d).getTime()));
  const uniqueForecastPoints = forecastPoints.filter(
    (fp) => !actualDates.has(fp.date.getTime())
  );

  if (uniqueForecastPoints.length === 0) {
    return null;
  }

  // Sort unique forecast points by date
  uniqueForecastPoints.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Combine: actual points first, then unique forecast points
  const combined = [...actualPoints, ...uniqueForecastPoints];

  return combined;
}