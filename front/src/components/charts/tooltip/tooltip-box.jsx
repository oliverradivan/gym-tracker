"use client";;
import { motion, useSpring } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useChartConfig } from "../chart-config-context";
import { chartCssVars } from "../chart-context";

function resolveTooltipHorizontalPosition({
  x,
  tooltipWidth,
  offset,
  containerWidth,
  viewportLeft = 0,
  viewportRight = containerWidth,
  isScrollViewport = false,
}) {
  const flipped = x + tooltipWidth + offset > viewportRight;
  const preferredLeft = flipped
    ? x - offset - tooltipWidth
    : x + offset;

  if (!isScrollViewport) {
    return { left: preferredLeft, flipped };
  }

  const minLeft = viewportLeft + offset;
  const maxLeft = Math.max(minLeft, viewportRight - tooltipWidth - offset);
  return {
    left: Math.max(minLeft, Math.min(maxLeft, preferredLeft)),
    flipped,
  };
}

// Inner-only-on-visible so `useSpring` initializes at the cursor's actual x/y
// instead of (0, 0) on first hover.
export function TooltipBox(props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = props.containerRef.current;
  if (!(mounted && container)) {
    return null;
  }
  if (!props.visible) {
    return null;
  }
  return <TooltipBoxInner {...props} container={container} />;
}

function TooltipBoxInner({
  x,
  y,
  containerWidth,
  containerHeight,
  offset = 16,
  className = "",
  children,
  left: leftOverride,
  top: topOverride,
  flipped: flippedOverride,
  springConfig,
  animate = true,
  entrance = true,
  panelStyle,
  backgroundColor = chartCssVars.tooltipBackground,
  container
}) {
  const { tooltipBoxSpring } = useChartConfig();
  const effectiveSpring = springConfig ?? tooltipBoxSpring;

  const tooltipRef = useRef(null);
  const tooltipWidthRef = useRef(180);
  const tooltipHeightRef = useRef(80);
  const [staticPosition, setStaticPosition] = useState({ left: x, top: y });

  const scrollViewport = container.closest(".chart-scroll-wrapper");
  const viewportLeft = scrollViewport?.scrollLeft ?? 0;
  const viewportRight = scrollViewport
    ? Math.min(
        containerWidth,
        viewportLeft + scrollViewport.clientWidth
      )
    : containerWidth;
  const tw = tooltipWidthRef.current;
  const th = tooltipHeightRef.current;
  const { left: targetX, flipped: shouldFlipX } =
    resolveTooltipHorizontalPosition({
      x,
      tooltipWidth: tw,
      offset,
      containerWidth,
      viewportLeft,
      viewportRight,
      isScrollViewport: scrollViewport !== null,
    });
  const targetY = Math.max(
    offset,
    Math.min(y - th / 2, containerHeight - th - offset)
  );

  const animatedLeft = useSpring(targetX, effectiveSpring);
  const animatedTop = useSpring(targetY, effectiveSpring);

  if (animate && leftOverride === undefined) {
    animatedLeft.set(targetX);
  }
  if (animate && topOverride === undefined) {
    animatedTop.set(targetY);
  }

  useLayoutEffect(() => {
    if (!tooltipRef.current) {
      return;
    }
    const el = tooltipRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w > 0) {
      tooltipWidthRef.current = w;
    }
    if (h > 0) {
      tooltipHeightRef.current = h;
    }
    const w2 = tooltipWidthRef.current;
    const h2 = tooltipHeightRef.current;
    const { left: tx } = resolveTooltipHorizontalPosition({
      x,
      tooltipWidth: w2,
      offset,
      containerWidth,
      viewportLeft,
      viewportRight,
      isScrollViewport: scrollViewport !== null,
    });
    const ty = Math.max(
      offset,
      Math.min(y - h2 / 2, containerHeight - h2 - offset)
    );
    if (!animate) {
      setStaticPosition({ left: tx, top: ty });
      return;
    }
    if (leftOverride === undefined) {
      animatedLeft.set(tx);
    }
    if (topOverride === undefined) {
      animatedTop.set(ty);
    }
  }, [
    x,
    y,
    containerWidth,
    containerHeight,
    viewportLeft,
    viewportRight,
    scrollViewport,
    offset,
    leftOverride,
    topOverride,
    animate,
    animatedLeft,
    animatedTop,
  ]);

  const prevFlipRef = useRef(shouldFlipX);
  const [flipKey, setFlipKey] = useState(0);

  useEffect(() => {
    if (prevFlipRef.current !== shouldFlipX) {
      setFlipKey((k) => k + 1);
      prevFlipRef.current = shouldFlipX;
    }
  }, [shouldFlipX]);

  const finalLeft = animate
    ? (leftOverride ?? animatedLeft)
    : staticPosition.left;
  const finalTop = animate ? (topOverride ?? animatedTop) : staticPosition.top;
  const isFlipped = flippedOverride ?? shouldFlipX;
  const transformOrigin = isFlipped ? "right top" : "left top";

  const panelClassName = cn(
    "min-w-[140px] overflow-hidden rounded-lg text-chart-tooltip-foreground shadow-lg",
    panelStyle?.backgroundColor === undefined &&
      backgroundColor === chartCssVars.tooltipBackground &&
      "bg-chart-tooltip-background",
    panelStyle?.backdropFilter === undefined && "backdrop-blur-md"
  );
  const panelStyleResolved = {
    transformOrigin,
    ...(panelStyle?.backgroundColor === undefined && {
      backgroundColor,
    }),
    ...panelStyle,
  };

  if (!entrance) {
    return createPortal(
      <div
        className={cn("pointer-events-none absolute z-50", className)}
        ref={tooltipRef}
        style={{ left: staticPosition.left, top: staticPosition.top }}
      >
        <div className={panelClassName} style={panelStyleResolved}>
          {children}
        </div>
      </div>,
      container
    );
  }

  return createPortal(
    <motion.div
      animate={{ opacity: 1 }}
      className={cn("pointer-events-none absolute z-50", className)}
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      ref={tooltipRef}
      style={{ left: finalLeft, top: finalTop }}
      transition={{ duration: 0.1 }}
    >
      <motion.div
        animate={{ scale: 1, opacity: 1, x: 0 }}
        className={panelClassName}
        initial={{ scale: 0.85, opacity: 0, x: isFlipped ? 20 : -20 }}
        key={flipKey}
        style={panelStyleResolved}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {children}
      </motion.div>
    </motion.div>,
    container
  );
}

TooltipBox.displayName = "TooltipBox";

export default TooltipBox;
