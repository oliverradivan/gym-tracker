"use client";;
import { localPoint } from "@visx/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScheduledTooltip } from "./use-scheduled-tooltip";
import { DEFAULT_Y_AXIS_ID, normalizeYAxisId } from "./y-axis-scales";

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
    projectionConfigs,
    containerRef,
    svgRef
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
  const debugPanelRef = useRef(null);
  const debugBaseTextRef = useRef("");
  const debugTouchTargetTextRef = useRef("");
  const touchMoveCountRef = useRef(0);
  const documentTouchMoveCountRef = useRef(0);
  const pointerEventCountRef = useRef(0);

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
      const index = bisectDate(combinedData, x0, 1);
      const d0 = combinedData[index - 1];
      const d1 = combinedData[index];

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
      const pointType = d.type ?? "actual";

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
        // Set it under the first line's dataKey so marker-rendering code
        // (which reads yPositions[line.dataKey]) can find it, but only if
        // that dataKey isn't already set from actual data.
        if (
          lines.length > 0 &&
          yPositions[lines[0].dataKey] == null
        ) {
          yPositions[lines[0].dataKey] = forecastScale(forecastValue) ?? 0;
        }
      }

      // Fallback: if tooltipData.yPositions doesn't have a specific dataKey,
      // compute y-position from the scale using the point's value for any
      // line dataKey that doesn't have a position yet.
      for (const line of lines) {
        if (
          yPositions[line.dataKey] == null &&
          typeof d[line.dataKey] === "number"
        ) {
          const axisScale = yScales[normalizeYAxisId(line.yAxisId)] ?? yScale;
          yPositions[line.dataKey] = axisScale(d[line.dataKey]) ?? 0;
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
    [xScale, yScale, yScales, data, lines, xAccessor, bisectDate, projectionConfigs]
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
        const svg = svgRef.current;
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
    [margin.left, svgRef]
  );

  const recordDebugEvent = useCallback(
    (event, eventType, chartX, tooltip) => {
      const panel = debugPanelRef.current;
      if (!panel) {
        return;
      }

      const timestamp = new Date().toISOString();
      if (eventType.startsWith("pointer")) {
        pointerEventCountRef.current += 1;
      }
      const touch = event.changedTouches?.[0] ?? event.touches?.[0];
      const clientX = touch?.clientX ?? event.clientX ?? null;
      const scrollWrapper =
        containerRef?.current?.closest(".chart-scroll-wrapper");
      const scrollOffset = scrollWrapper?.scrollLeft ?? 0;
      const chartWidth = xScale.range?.()?.at(-1) ?? null;
      const firstLine = lines[0];
      const axisScale = firstLine
        ? yScales[normalizeYAxisId(firstLine.yAxisId)] ?? yScale
        : yScale;
      const point = tooltip?.point;
      const pointType = tooltip?.pointType ?? point?.type ?? "actual";
      const rawValue =
        pointType === "forecast"
          ? point?.value
          : firstLine
            ? point?.[firstLine.dataKey]
            : undefined;
      const dotY = firstLine
        ? tooltip?.yPositions?.[firstLine.dataKey]
        : undefined;
      const domain = axisScale?.domain?.() ?? [];
      const distance =
        chartX != null && tooltip?.x != null
          ? Math.abs(tooltip.x - chartX)
          : null;
      const eventCount =
        eventType === "touchmove"
          ? ` #${touchMoveCountRef.current}`
          : eventType.startsWith("pointer")
            ? ` #${pointerEventCountRef.current}`
            : "";

      debugBaseTextRef.current = [
        `[CHART] ${eventType}${eventCount} @ ${timestamp}`, // DEBUG: last event, count, and timestamp
        `clientX: ${clientX ?? "none"} | chartX: ${chartX ?? "none"}`, // DEBUG: raw and converted x
        `cancelable: ${event.cancelable ?? "none"} | defaultPrevented: ${event.defaultPrevented ?? "none"}`, // DEBUG: whether the touch handler canceled native scrolling
        `scrollLeft: ${scrollOffset} | chartWidth: ${chartWidth ?? "none"}`, // DEBUG: scroll offset and x-scale width
        `nearest: ${tooltip ? `${tooltip.index} (${pointType})` : "none"}`, // DEBUG: nearest hit-test point
        `distance: ${distance ?? "none"}px | max: none (nearest-point snap)`, // DEBUG: distance and hit-test threshold
        `dotY: ${dotY ?? "none"}px | value: ${rawValue ?? "none"}`, // DEBUG: dot y pixel and source value
        `yDomain: [${domain.join(", ")}] | yScale: ${firstLine?.dataKey ?? "default"}`, // DEBUG: scale and domain used for dot
      ].join("\n");
      panel.textContent = [debugBaseTextRef.current, debugTouchTargetTextRef.current]
        .filter(Boolean)
        .join("\n");
      if (
        (eventType.startsWith("touch") && eventType !== "touchmove") ||
        eventType.startsWith("pointer")
      ) {
        console.info(
          `[CHART] ${eventType}${eventCount} @ ${timestamp}`,
          { clientX, chartX, nearest: tooltip?.index ?? "none" }
        );
      }
    },
    [
      containerRef,
      debugBaseTextRef,
      debugTouchTargetTextRef,
      lines,
      pointerEventCountRef,
      touchMoveCountRef,
      xScale,
      yScale,
      yScales,
    ]
  );

  useEffect(() => {
    if (projectionConfigs.length === 0 || debugPanelRef.current) {
      return;
    }

    const panel = document.createElement("pre");
    panel.setAttribute("aria-hidden", "true");
    panel.style.cssText =
      "position:fixed;top:8px;left:8px;z-index:99999;max-width:calc(100vw - 16px);margin:0;padding:8px;border:1px solid rgba(255,255,255,.35);border-radius:6px;background:rgba(0,0,0,.88);color:#fff;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;pointer-events:none;";
    panel.textContent = "Chart diagnostics ready; touch or hover the chart.";
    document.body.appendChild(panel);
    debugPanelRef.current = panel;

    let startTarget = null;
    const describeTarget = (target) => {
      if (!(target instanceof Element)) {
        return "none";
      }
      const className =
        typeof target.className === "string"
          ? target.className
          : target.className?.baseVal ?? "";
      return `${target.tagName.toLowerCase()}${className ? `.${className.trim().replace(/\s+/g, ".")}` : ""}`;
    };
    const updateTouchTargetLog = (eventType, event) => {
      const timestamp = new Date().toISOString();
      const count =
        eventType === "touchmove"
          ? ` #${++documentTouchMoveCountRef.current}`
          : "";
      const target = event.target;
      const connected = target instanceof Node && target.isConnected;
      const sameTarget = target === startTarget;
      const scrollOffset =
        containerRef?.current?.closest(".chart-scroll-wrapper")?.scrollLeft ?? 0;
      debugTouchTargetTextRef.current = [
        `[CHART] document ${eventType}${count} @ ${timestamp} target: ${describeTarget(target)}`, // DEBUG: document event type, count, timestamp, tag, and class
        `[CHART] target connected: ${connected} | same as touchstart target: ${sameTarget}`, // DEBUG: target connectivity and identity
        `[CHART] document scrollLeft: ${scrollOffset}`, // DEBUG: scroll position sampled at document event time
      ].join("\n");
      console.info(
        `[CHART] document ${eventType}${count} @ ${timestamp}`,
        {
          target: describeTarget(target),
          isConnected: connected,
          sameAsTouchStartTarget: sameTarget,
          scrollLeft: scrollOffset,
        }
      );
      if (debugPanelRef.current) {
        debugPanelRef.current.textContent = [
          debugBaseTextRef.current,
          debugTouchTargetTextRef.current,
        ]
          .filter(Boolean)
          .join("\n");
      }
    };
    const appendDebugError = (message) => {
      debugTouchTargetTextRef.current = [
        debugTouchTargetTextRef.current,
        `[CHART] ${message}`,
      ]
        .filter(Boolean)
        .slice(-4)
        .join("\n");
      if (debugPanelRef.current) {
        debugPanelRef.current.textContent = [
          debugBaseTextRef.current,
          debugTouchTargetTextRef.current,
        ]
          .filter(Boolean)
          .join("\n");
      }
    };
    const handleDocumentTouchStart = (event) => {
      if (!containerRef?.current?.contains(event.target)) {
        return;
      }
      startTarget = event.target;
      updateTouchTargetLog("touchstart", event);
    };
    const handleDocumentTouchMove = (event) => {
      if (startTarget) {
        updateTouchTargetLog("touchmove", event);
      }
    };
    const handleDocumentTouchEnd = (event) => {
      if (startTarget) {
        updateTouchTargetLog("touchend", event);
        startTarget = null;
      }
    };
    const handleDocumentTouchCancel = (event) => {
      if (startTarget) {
        updateTouchTargetLog("touchcancel", event);
        startTarget = null;
      }
    };
    const handleWindowError = (event) => {
      console.error(
        "[CHART] window error",
        event.error?.stack ?? event.message
      );
      appendDebugError(`window error: ${event.message}`);
    };
    const handleUnhandledRejection = (event) => {
      const reason = event.reason;
      console.error("[CHART] unhandledrejection", reason?.stack ?? reason);
      appendDebugError(
        `unhandledrejection: ${reason?.message ?? String(reason)}`
      );
    };
    document.addEventListener("touchstart", handleDocumentTouchStart, true);
    document.addEventListener("touchmove", handleDocumentTouchMove, true);
    document.addEventListener("touchend", handleDocumentTouchEnd, true);
    document.addEventListener("touchcancel", handleDocumentTouchCancel, true);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      document.removeEventListener("touchstart", handleDocumentTouchStart, true);
      document.removeEventListener("touchmove", handleDocumentTouchMove, true);
      document.removeEventListener("touchend", handleDocumentTouchEnd, true);
      document.removeEventListener("touchcancel", handleDocumentTouchCancel, true);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      panel.remove();
      debugPanelRef.current = null;
    };
  }, [
    containerRef,
    debugBaseTextRef,
    debugTouchTargetTextRef,
    documentTouchMoveCountRef,
    projectionConfigs,
  ]);

  const handlePointerDiagnostic = useCallback(
    (event, eventType) => {
      const chartX = getChartX(event);
      const tooltip = chartX == null ? null : resolveTooltipFromX(chartX);
      recordDebugEvent(event, eventType, chartX, tooltip);
    },
    [getChartX, recordDebugEvent, resolveTooltipFromX]
  );

  const handleMouseMove = useCallback(
    (event) => {
      const chartX = getChartX(event);
      if (chartX === null) {
        recordDebugEvent(event, "mousemove", null, null);
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
      recordDebugEvent(event, "mousemove", chartX, tooltip);
      if (tooltip) {
        scheduleTooltip(tooltip);
      }
    },
    [getChartX, recordDebugEvent, resolveTooltipFromX, resolveIndexFromX, scheduleTooltip]
  );

  const handleMouseLeave = useCallback((event) => {
    recordDebugEvent(event, "pointerleave", null, null);
    lastHoveredXRef.current = null;
    clearTooltip();
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
    setSelection(null);
  }, [clearTooltip, recordDebugEvent]);

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
        recordDebugEvent(event, "touchstart", chartX, tooltip);
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
      recordDebugEvent,
      resolveTooltipFromX,
      resolveIndexFromX,
      scheduleTooltip,
      resetTooltipDedupe,
      clearTooltip,
    ]
  );

  const handleTouchMove = useCallback(
    (event) => {
      touchMoveCountRef.current += 1;
      const timestamp = new Date().toISOString();
      const touch = event.touches[0];
      console.info(
        `[CHART] touchmove handler #${touchMoveCountRef.current} @ ${timestamp}`,
        { clientX: touch?.clientX ?? "none" }
      );
      recordDebugEvent(event, "touchmove", null, null);
      try {
        if (event.touches.length === 1) {
          event.preventDefault();
          const chartX = getChartX(event, 0);
          if (chartX === null) {
            recordDebugEvent(event, "touchmove", null, null);
            return;
          }
          lastHoveredXRef.current = chartX;
          const tooltip = resolveTooltipFromX(chartX);
          recordDebugEvent(event, "touchmove", chartX, tooltip);
          if (tooltip) {
            scheduleTooltip(tooltip);
          }
        } else if (event.touches.length === 2) {
          event.preventDefault();
          const x0 = getChartX(event, 0);
          const x1 = getChartX(event, 1);
          if (x0 === null || x1 === null) {
            recordDebugEvent(event, "touchmove", null, null);
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
      } catch (error) {
        console.error(
          "[CHART] touchmove handler failed",
          error instanceof Error ? error.stack : error
        );
        throw error;
      }
    },
    [getChartX, recordDebugEvent, resolveTooltipFromX, resolveIndexFromX, scheduleTooltip]
  );

  const handleTouchCancel = useCallback(
    (event) => recordDebugEvent(event, "touchcancel", null, null),
    [recordDebugEvent]
  );

  const handlePointerCancel = useCallback(
    (event) => handlePointerDiagnostic(event, "pointercancel"),
    [handlePointerDiagnostic]
  );

  const handlePointerDown = useCallback(
    (event) => handlePointerDiagnostic(event, "pointerdown"),
    [handlePointerDiagnostic]
  );

  const handlePointerLeave = useCallback(
    (event) => handlePointerDiagnostic(event, "pointerleave"),
    [handlePointerDiagnostic]
  );

  const handlePointerMove = useCallback(
    (event) => handlePointerDiagnostic(event, "pointermove"),
    [handlePointerDiagnostic]
  );

  const handlePointerUp = useCallback(
    (event) => handlePointerDiagnostic(event, "pointerup"),
    [handlePointerDiagnostic]
  );

  const handleTouchEnd = useCallback((event) => {
    recordDebugEvent(event, "touchend", null, null);
    clearTooltip();
    setSelection(null);
  }, [clearTooltip, recordDebugEvent]);

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
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
        onPointerLeave: handlePointerLeave,
      }
    : {};
  const touchInteractionHandlers = canInteract
    ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchCancel,
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
    touchInteractionHandlers,
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
export function buildCombinedData(actualData, projectionConfigs, xAccessor) {
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