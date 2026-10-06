"use client";;
import {
  memo,
  useMemo,
  useRef,
} from "react";
import {
  DEFAULT_ANIMATION_EASING,
  DEFAULT_CHART_ENTER_TRANSITION,
} from "./animation";
import { ChartProvider } from "./chart-provider";
import {
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
} from "./chart-phase";
import { ChartRevealClip } from "./chart-reveal-clip";
import { useChartChildLayers } from "./use-chart-child-layers";
import { useReferenceAreaRegistration } from "./use-reference-area-registration";
import { ReferenceAreaRegistrationContext } from "./reference-area-registration-context";
import {
  computeSeriesBarRevealClipPadding,
  computeSeriesBarWidth,
} from "./series-bar-layout";
import { useStaticChartPreview } from "./static-chart-preview-context";
import { useChartInteraction } from "./use-chart-interaction";
import { useChartDataModel } from "./use-chart-data-model";

export function TimeSeriesChartInner(props) {
  const { width, height } = props;
  if (width < 10 || height < 10) {
    return null;
  }
  return <TimeSeriesChartCore {...props} />;
}

const TimeSeriesChartCore = memo(function TimeSeriesChartCore({
  width,
  height,
  data,
  xDataKey,
  margin,
  animationDuration,
  animationEasing = DEFAULT_ANIMATION_EASING,
  enterTransition,
  revealSignature = "",
  children,
  containerRef,
  lines,
  clipPathId,
  composedBarDataKeys,
  composedBarSize,
  composedMaxBarSize,
  composedBarGap,
  composedStacked,
  composedStackOffsets,
  composedStackGap,
  yScaleDomainMax,
  chartStatus = DEFAULT_CHART_STATUS,
  loadingLabel,
  yDomainTween = true,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  xDomain,
  xDomainSlotCount,
  tweenYDomainOnXDomainChange = false,
  onPhaseChange
}) {
  const staticPreview = useStaticChartPreview();
  const svgRef = useRef(null);
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const {
    chartPhase,
    plotData,
    revealEpoch,
    concealEpoch,
    isLoaded,
    notifyLoadingPulseComplete,
    notifyRevealConcealComplete,
    bisectDate,
    columnWidth,
    dateLabels,
    isInteractionPhase,
    projectionConfigs,
    renderData,
    visiblePlotData,
    xAccessor,
    xScale,
    yDomainSkeletonByAxis,
    yDomainTargetByAxis,
    yScale,
    yScales,
  } = useChartDataModel({
    animationDuration,
    chartStatus,
    children,
    data,
    innerHeight,
    innerWidth,
    lines,
    onPhaseChange,
    revealSignature,
    staticPreview,
    tweenYDomainOnXDomainChange,
    xDataKey,
    xDomain,
    xDomainSlotCount,
    yDomainTween,
    yDomainTweenDuration,
    yScaleDomainMax,
  });

  const canInteract = isLoaded && isInteractionPhase;

  const {
    tooltipData,
    setTooltipData,
    selection,
    clearSelection,
    interactionHandlers,
    touchInteractionHandlers,
    interactionStyle,
  } = useChartInteraction({
    bisectDate,
    canInteract,
    data: visiblePlotData,
    lines,
    margin,
    xAccessor,
    xScale,
    svgRef,
    yScale,
    yScales,
    projectionConfigs,
  });

  const {
    defsChildren,
    clipExcludedChildren,
    underlayChildren,
    preOverlayChildren,
    postOverlayChildren,
  } = useChartChildLayers(children);
  const { referenceAreaRegistration, referenceAreas } =
    useReferenceAreaRegistration(children);

  const contextValue = useMemo(
    () => ({
      data: visiblePlotData,
      renderData,
      xScale,
      yScale,
      yScales,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      columnWidth,
      tooltipData,
      setTooltipData,
      containerRef,
      lines,
      referenceAreas,
      chartPhase,
      chartStatus,
      loadingLabel,
      yDomainTweenDuration,
      yDomainSkeletonByAxis,
      yDomainTargetByAxis,
      isLoaded,
      animationDuration,
      animationEasing,
      enterTransition,
      revealEpoch,
      notifyLoadingPulseComplete,
      xAccessor,
      dateLabels,
      xDomain,
      xDomainSlotCount,
      selection,
      clearSelection,
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    }),
    [
      visiblePlotData,
      renderData,
      xScale,
      yScale,
      yScales,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      columnWidth,
      tooltipData,
      setTooltipData,
      containerRef,
      lines,
      referenceAreas,
      chartPhase,
      chartStatus,
      loadingLabel,
      yDomainTweenDuration,
      yDomainSkeletonByAxis,
      yDomainTargetByAxis,
      isLoaded,
      animationDuration,
      animationEasing,
      enterTransition,
      revealEpoch,
      notifyLoadingPulseComplete,
      xAccessor,
      dateLabels,
      xDomain,
      xDomainSlotCount,
      selection,
      clearSelection,
      composedBarDataKeys,
      composedBarSize,
      composedMaxBarSize,
      composedBarGap,
      composedStacked,
      composedStackOffsets,
      composedStackGap,
    ]
  );

  const useClipReveal =
    !staticPreview &&
    renderData.length > 1 &&
    innerWidth > 0 &&
    animationDuration > 0;
  const isRevealAnimating = chartPhase === "revealing";
  const isRevealConcealing =
    chartPhase === "exitingReady" && animationDuration > 0;

  const effectiveEnterTransition =
    enterTransition ??
    ({
      ...DEFAULT_CHART_ENTER_TRANSITION,
      duration: animationDuration / 1000
    });

  const revealClipPadding = useMemo(() => {
    if (!composedBarDataKeys?.length) {
      return 0;
    }
    const barWidth = computeSeriesBarWidth({
      columnWidth,
      composedBarGap,
      composedBarSize,
      composedMaxBarSize,
      dataLength: plotData.length,
      innerWidth,
      seriesCount: composedBarDataKeys.length,
      stacked: composedStacked,
    });
    return computeSeriesBarRevealClipPadding({
      barWidth,
      gap: composedBarGap,
      seriesCount: composedBarDataKeys.length,
      stacked: composedStacked,
    });
  }, [
    columnWidth,
    composedBarDataKeys,
    composedBarGap,
    composedBarSize,
    composedMaxBarSize,
    composedStacked,
    innerWidth,
    plotData.length,
  ]);

  return (
    <ReferenceAreaRegistrationContext.Provider
      value={referenceAreaRegistration}
    >
      <ChartProvider value={contextValue}>
        <svg aria-hidden="true" height={height} ref={svgRef} width={width}>
          <defs>
            {defsChildren}
            {useClipReveal ? (
              <ChartRevealClip
                animating={isRevealAnimating || isRevealConcealing}
                clipPathId={clipPathId}
                enterTransition={effectiveEnterTransition}
                height={innerHeight + 20}
                mode={isRevealConcealing ? "conceal" : "reveal"}
                onComplete={
                  isRevealConcealing ? notifyRevealConcealComplete : undefined
                }
                padding={revealClipPadding}
                revealEpoch={isRevealConcealing ? concealEpoch : revealEpoch}
                targetWidth={innerWidth}
              />
            ) : null}
          </defs>

          <rect fill="transparent" height={height} width={width} x={0} y={0} />

          <g
            {...interactionHandlers}
            {...(projectionConfigs.length === 0
              ? touchInteractionHandlers
              : undefined)}
            style={interactionStyle}
            transform={`translate(${margin.left},${margin.top})`}
          >
            <rect
              fill="transparent"
              height={innerHeight}
              width={innerWidth}
              x={0}
              y={0}
            />

            {clipExcludedChildren}
            {underlayChildren}
            {useClipReveal ? (
              <g clipPath={`url(#${clipPathId})`}>{preOverlayChildren}</g>
            ) : (
              preOverlayChildren
            )}
            {postOverlayChildren}
            {projectionConfigs.length > 0 ? (
              <rect
                {...touchInteractionHandlers}
                fill="transparent"
                height={innerHeight}
                pointerEvents="all"
                width={innerWidth}
                x={0}
                y={0}
              />
            ) : null}
          </g>
        </svg>
      </ChartProvider>
    </ReferenceAreaRegistrationContext.Provider>
  );
});