"use client";;
import { motion, useSpring } from "motion/react";
import { useEffect } from "react";
import { useChartConfig } from "../chart-config-context";
import { chartCssVars } from "../chart-context";
import { indicatorFadeGradientStops, resolveVerticalFadeSides } from "../indicator-fade";

function resolveWidth(width) {
  if (typeof width === "number") {
    return width;
  }
  switch (width) {
    case "line":
      return 1;
    case "thin":
      return 2;
    case "medium":
      return 4;
    case "thick":
      return 8;
    default:
      return 1;
  }
}

// Inner-only-on-visible so `useSpring` initializes at the real cursor x
// instead of 0 on first hover.
export function TooltipIndicator(props) {
  if (!props.visible) {
    return null;
  }
  return <TooltipIndicatorInner {...props} />;
}

function TooltipIndicatorInner({
  x,
  visible,
  height,
  width = "line",
  span,
  columnWidth,
  colorEdge = chartCssVars.crosshair,
  colorMid = chartCssVars.crosshair,
  fadeEdges = "both",
  fadeLength = 10,
  animate = true,
  gradientId = "tooltip-indicator-gradient",
  springConfig,
  strokeDasharray
}) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;

  const pixelWidth =
    span !== undefined && columnWidth !== undefined
      ? span * columnWidth
      : resolveWidth(width);

  const rectX = x - pixelWidth / 2;
  const lineX = x;
  const animatedX = useSpring(rectX, effectiveSpring);
  const animatedLineX = useSpring(lineX, effectiveSpring);

  if (animate) {
    animatedX.set(rectX);
    animatedLineX.set(lineX);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: we need to jump the animatedX when the visible prop changes
  useEffect(() => {
    animatedX.set(rectX);
    animatedLineX.set(lineX);
  }, [animatedLineX, animatedX, lineX, rectX, visible]);

  const indicatorFill = colorMid || colorEdge;
  const fadeSides = resolveVerticalFadeSides(fadeEdges);
  const dashed = Boolean(strokeDasharray);

  if (dashed) {
    const strokeWidth = Math.max(1, pixelWidth);
    return animate ? (
      <motion.line
        stroke={indicatorFill}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
        x1={animatedLineX}
        x2={animatedLineX}
        y1={0}
        y2={height}
      />
    ) : (
      <line
        stroke={indicatorFill}
        strokeDasharray={strokeDasharray}
        strokeWidth={strokeWidth}
        x1={lineX}
        x2={lineX}
        y1={0}
        y2={height}
      />
    );
  }

  if (!fadeSides.any) {
    return animate ? (
      <motion.rect
        fill={indicatorFill}
        height={height}
        width={pixelWidth}
        x={animatedX}
        y={0}
      />
    ) : (
      <rect
        fill={indicatorFill}
        height={height}
        width={pixelWidth}
        x={rectX}
        y={0}
      />
    );
  }

  const fadeStops = indicatorFadeGradientStops(fadeSides, fadeLength);

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
          {fadeStops.map((stop) => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              style={{ stopColor: indicatorFill, stopOpacity: stop.opacity }}
            />
          ))}
        </linearGradient>
      </defs>
      {animate ? (
        <motion.rect
          fill={`url(#${gradientId})`}
          height={height}
          width={pixelWidth}
          x={animatedX}
          y={0}
        />
      ) : (
        <rect
          fill={`url(#${gradientId})`}
          height={height}
          width={pixelWidth}
          x={rectX}
          y={0}
        />
      )}
    </g>
  );
}

TooltipIndicator.displayName = "TooltipIndicator";

export function HorizontalTooltipIndicator(props) {
  if (!props.visible || props.y == null) {
    return null;
  }
  return <HorizontalTooltipIndicatorInner {...props} />;
}

function HorizontalTooltipIndicatorInner({
  y,
  visible,
  width,
  colorEdge = chartCssVars.crosshair,
  colorMid = chartCssVars.crosshair,
  animate = true,
  springConfig,
  strokeDasharray
}) {
  const { tooltipSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipSpring;

  const animatedY = useSpring(y, effectiveSpring);

  if (animate) {
    animatedY.set(y);
  }

  useEffect(() => {
    animatedY.set(y);
  }, [animatedY, y, visible]);

  const indicatorFill = colorMid || colorEdge;
  const dashed = Boolean(strokeDasharray);

  if (dashed) {
    return animate ? (
      <motion.line
        stroke={indicatorFill}
        strokeDasharray={strokeDasharray}
        strokeWidth={1}
        x1={0}
        x2={width}
        y1={animatedY}
        y2={animatedY}
      />
    ) : (
      <line
        stroke={indicatorFill}
        strokeDasharray={strokeDasharray}
        strokeWidth={1}
        x1={0}
        x2={width}
        y1={y}
        y2={y}
      />
    );
  }

  return animate ? (
    <motion.line
      stroke={indicatorFill}
      strokeWidth={1}
      x1={0}
      x2={width}
      y1={animatedY}
      y2={animatedY}
    />
  ) : (
    <line
      stroke={indicatorFill}
      strokeWidth={1}
      x1={0}
      x2={width}
      y1={y}
      y2={y}
    />
  );
}

HorizontalTooltipIndicator.displayName = "HorizontalTooltipIndicator";

export default TooltipIndicator;
