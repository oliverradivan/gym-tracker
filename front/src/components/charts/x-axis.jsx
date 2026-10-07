"use client";;
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useChart, useChartStable } from "./chart-context";
import { shortDateFmt } from "./chart-formatters";
import { DEFAULT_Y_DOMAIN_TWEEN_MS } from "./chart-phase";
import { buildIntervalTicks } from "./interval-ticks";
import { appendProjectionTailTicks, buildDataAlignedTicks, buildDomainTicks, domainExtendsPastData } from "./x-axis-layout";
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";

const X_AXIS_POSITION_TWEEN_MS = DEFAULT_Y_DOMAIN_TWEEN_MS;

function XAxisLabel({
  label,
  x,
  crosshairX,
  hoveredLabel,
  isHovering,
  tickerHalfWidth,
  animatePosition
}) {
  const fadeBuffer = 20;
  const fadeRadius = tickerHalfWidth + fadeBuffer;

  let opacity = 1;
  if (isHovering && crosshairX !== null) {
    const distance = Math.abs(x - crosshairX);
    if (distance < tickerHalfWidth) {
      opacity = 0;
    } else if (hoveredLabel && label === hoveredLabel) {
      opacity = 0;
    } else if (distance < fadeRadius) {
      opacity = (distance - tickerHalfWidth) / fadeBuffer;
    }
  }

  return (
    <div
      className="absolute"
      style={{
        left: x,
        bottom: 12,
        width: 0,
        display: "flex",
        justifyContent: "center",
        transition: animatePosition
          ? `left ${X_AXIS_POSITION_TWEEN_MS}ms cubic-bezier(${LINE_LOADING_PULSE_EASE.join(", ")})`
          : undefined,
      }}
    >
      <span
        className={cn("whitespace-nowrap text-chart-label text-xs")}
        style={{
          opacity,
          transition: "opacity 0.4s ease-in-out",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function XAxis(props) {
  const { containerRef } = useChartStable();
  const [container, setContainer] = useState(null);

  useEffect(() => {
    setContainer(containerRef.current);
  }, [containerRef]);

  if (!container) {
    return null;
  }

  return <XAxisInner {...props} container={container} />;
}

const XAxisInner = memo(function XAxisInner({
  numTicks = 5,
  tickerHalfWidth = 50,
  tickMode = "data",
  intervalDays,
  container
}) {
  const { xScale, margin, tooltipData, data, xAccessor, dateLabels, xDomain } =
    useChart();

  const labelsToShow = useMemo(() => {
    // Fixed-interval mode (e.g. every 4 days): labels are NOT tied to data
    // point dates. Grid uses the same generator via its `intervalDays` prop,
    // so lines and labels stay in sync and the first tick always starts
    // exactly at the domain start.
    if (tickMode === "interval") {
      return buildIntervalTicks({
        xScale,
        marginLeft: margin.left,
        intervalDays: intervalDays ?? 4,
      });
    }

    const projectionExtendsScale =
      tickMode === "data" && domainExtendsPastData(data, xAccessor, xScale);

    if (tickMode === "domain") {
      return buildDomainTicks({
        marginLeft: margin.left,
        numTicks,
        xScale,
      });
    }

    // No brush: evenly spaced ticks across the full domain (data + projection).
    if (projectionExtendsScale && xDomain == null) {
      return buildDomainTicks({
        marginLeft: margin.left,
        numTicks,
        xScale,
      });
    }

    const dataTicks = buildDataAlignedTicks({
      data,
      dateLabels,
      marginLeft: margin.left,
      targetTickCount: numTicks,
      xAccessor,
      xScale,
    });

    // Brush: keep data-aligned ticks, add labels only in the projection tail.
    if (projectionExtendsScale && xDomain != null) {
      return appendProjectionTailTicks(
        dataTicks,
        data,
        xAccessor,
        xScale,
        margin.left,
        Math.max(1, numTicks - dataTicks.length + 1)
      );
    }

    return dataTicks;
  }, [
    tickMode,
    intervalDays,
    xDomain,
    data,
    dateLabels,
    xAccessor,
    xScale,
    margin.left,
    numTicks,
  ]);

  const isHovering = tooltipData !== null;
  const crosshairX = tooltipData ? tooltipData.x + margin.left : null;
  const hoveredLabel =
    isHovering && tooltipData
      ? (dateLabels[tooltipData.index] ??
        shortDateFmt.format(xAccessor(tooltipData.point)))
      : null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0">
      {labelsToShow.map((item) => (
        <XAxisLabel
          animatePosition={xDomain == null}
          crosshairX={crosshairX}
          hoveredLabel={hoveredLabel}
          isHovering={isHovering}
          key={`${item.date.getTime()}-${item.x}`}
          label={item.label}
          tickerHalfWidth={tickerHalfWidth}
          x={item.x}
        />
      ))}
    </div>,
    container
  );
});

XAxis.displayName = "XAxis";

export default XAxis;