"use client";
import { curveLinear } from "@visx/curve";
import { LinePath } from "@visx/shape";
import { useCallback, useId, useMemo } from "react";
import { useChartHover, useChartStable, useYScale } from "./chart-context";
import { buildHorizontalTangentBezierPath } from "./projection-utils";
import { SeriesMarkers } from "./series-markers";

function resolveVisibleEndX(endX, innerWidth, endpointRadius, strokeWidth) {
  const edgePadding = endpointRadius + strokeWidth * 0.5 + 1;
  return Math.min(endX, Math.max(0, innerWidth - edgePadding));
}

function renderProjectionStroke({
  bezierPath,
  curve,
  curveKind,
  data,
  getX,
  getY,
  linearPath,
  strokeProps
}) {
  if (curveKind === "bezier" && bezierPath) {
    return <path d={bezierPath} fill="none" {...strokeProps} />;
  }
  if (curveKind === "linear" && linearPath) {
    return <path d={linearPath} fill="none" {...strokeProps} />;
  }
  return (
    <LinePath
      curve={curve ?? curveLinear}
      data={data}
      {...strokeProps}
      x={getX}
      y={getY}
    />
  );
}

export function ProjectionLine({
  data,
  dataKey = "value",
  yAxisId,
  stroke = "var(--chart-3)",
  strokeStyle = "solid",
  gradientStart,
  gradientEnd = "var(--chart-5)",
  strokeWidth = 2,
  curveKind = "linear",
  curve,
  strokeDasharray = "6,4",
  strokeOpacity = 1,
  showEndMarker,
  showEndpoints,
  endpointRadius = 5,
  className,
  showMarkers = false
}) {
  const { xScale, chartPhase, innerWidth } = useChartStable();
  const { setTooltipData } = useChartHover();
  const yScale = useYScale(yAxisId);
  const gradientId = useId().replace(/:/g, "");
  const showMarker = showEndMarker ?? showEndpoints ?? true;
  const resolvedGradientStart = gradientStart ?? stroke;

  const getX = useCallback(
    (point) => xScale(point.date) ?? 0,
    [xScale]
  );

  const getY = useCallback(
    (point) => yScale(point[dataKey] ?? point.value ?? point.actualValue) ?? 0,
    [yScale, dataKey]
  );

  const handlePointClick = useCallback((point, index) => {
    setTooltipData({ point, index, x: getX(point), yPositions: { [dataKey]: getY(point) } });
  }, [dataKey, getX, getY, setTooltipData]);

  const startPoint = data[0];
  const endPoint = data.at(-1);

  const geometry = useMemo(() => {
    if (!(startPoint && endPoint)) {
      return null;
    }
    const startX = getX(startPoint);
    const startY = getY(startPoint);
    const endX = getX(endPoint);
    const endY = getY(endPoint);
    const visibleEndX = resolveVisibleEndX(
      endX,
      innerWidth,
      showMarker ? endpointRadius : 0,
      strokeWidth
    );
    return { startX, startY, visibleEndX, endY };
  }, [
    endPoint,
    endpointRadius,
    getX,
    getY,
    innerWidth,
    showMarker,
    startPoint,
    strokeWidth,
  ]);

  const bezierPath = useMemo(() => {
    if (curveKind !== "bezier" || !geometry) {
      return null;
    }
    return buildHorizontalTangentBezierPath(
      geometry.startX,
      geometry.startY,
      geometry.visibleEndX,
      geometry.endY
    );
  }, [curveKind, geometry]);

  const linearPath = useMemo(() => {
    if (curveKind !== "linear" || !geometry) {
      return null;
    }
    const segments = data.map((point, index) => {
      const isLast = index === data.length - 1;
      const x = isLast ? geometry.visibleEndX : getX(point);
      const y = getY(point);
      return `${index === 0 ? "M" : "L"} ${x},${y}`;
    });
    return segments.join(" ");
  }, [curveKind, geometry, data, getX, getY]);

  const showStroke =
    chartPhase === "revealing" ||
    chartPhase === "ready" ||
    chartPhase === "exitingReady";

  if (data.length < 2 || !geometry) {
    return null;
  }

  const resolvedStroke =
    strokeStyle === "gradient" && geometry ? `url(#${gradientId})` : stroke;
  const strokeProps = {
    stroke: showStroke ? resolvedStroke : "transparent",
    strokeDasharray,
    strokeLinecap: "round",
    strokeOpacity,
    strokeWidth,
  };

  return (
    <g className={className ?? "chart-projection-line"}>
      {strokeStyle === "gradient" && geometry ? (
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={gradientId}
            x1={geometry.startX}
            x2={geometry.visibleEndX}
            y1={geometry.startY}
            y2={geometry.endY}
          >
            <stop offset="0%" stopColor={resolvedGradientStart} />
            <stop offset="100%" stopColor={gradientEnd} />
          </linearGradient>
        </defs>
      ) : null}
      {renderProjectionStroke({
        bezierPath,
        curve,
        curveKind,
        data,
        getX,
        getY,
        linearPath,
        strokeProps,
      })}
      {showMarkers && (
        <SeriesMarkers
          data={data.length > 1 ? data.slice(1) : data}
          dataKey={dataKey}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill={stroke}
          radius={2}
          onPointClick={handlePointClick}
        />
      )}
    </g>
  );
}

ProjectionLine.displayName = "ProjectionLine";

export default ProjectionLine;