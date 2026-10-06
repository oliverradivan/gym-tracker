import { scaleLinear, scaleTime } from "@visx/scale";
import { bisector, extent } from "d3-array";
import { useCallback, useEffect, useMemo } from "react";
import { shortDateFmt } from "./chart-formatters";
import {
  DEFAULT_CHART_STATUS,
  DEFAULT_Y_DOMAIN_TWEEN_MS,
  isChartInteractionPhase,
} from "./chart-phase";
import { decimateTimeSeries, maxRenderPointsForWidth } from "./decimate-time-series";
import { filterDataByXDomain } from "./filter-data-by-x-domain";
import {
  generateChartSkeletonData,
  generateChartSkeletonFromTarget,
} from "./generate-chart-skeleton-data";
import {
  extractProjectionLineConfigs,
  mergeProjectionXDomainMax,
  mergeProjectionYDomain,
} from "./projection-config";
import { useAnimatedYDomains } from "./use-animated-y-domains";
import { useChartPhaseOrchestrator } from "./use-chart-phase-orchestrator";
import {
  buildYScalesFromDomains,
  DEFAULT_Y_AXIS_ID,
  getPrimaryYScale,
  groupLinesByYAxisId,
} from "./y-axis-scales";
import { computeYDomainsByAxis } from "./y-domain-utils";
import { buildCombinedData } from "./use-chart-interaction";

function collectNumericExtents(data, dataKeys) {
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (const datum of data) {
    for (const key of dataKeys) {
      const value = datum[key];
      if (typeof value === "number") {
        if (value < minValue) minValue = value;
        if (value > maxValue) maxValue = value;
      }
    }
  }

  if (minValue === Number.POSITIVE_INFINITY) {
    return { minValue: 0, maxValue: 100 };
  }

  return { minValue, maxValue };
}

function resolveTimeSeriesYDomain(data, dataKeys, yScaleDomainMax) {
  if (yScaleDomainMax != null && yScaleDomainMax > 0) {
    return [0, yScaleDomainMax * 1.1];
  }

  const { minValue, maxValue } = collectNumericExtents(data, dataKeys);

  if (minValue >= 0) {
    const top = maxValue <= 0 ? 100 : maxValue * 1.1;
    return [0, top];
  }

  const padding = (maxValue - minValue) * 0.05 || 1;
  return [minValue - padding, maxValue + padding];
}

export function useChartDataModel({
  animationDuration,
  chartStatus = DEFAULT_CHART_STATUS,
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
  yDomainTween = true,
  yDomainTweenDuration = DEFAULT_Y_DOMAIN_TWEEN_MS,
  yScaleDomainMax,
}) {
  const resolveYDomain = useCallback(
    (sourceData, dataKeys) => {
      const axisGroups = groupLinesByYAxisId(lines);
      const usesDefaultOnly =
        axisGroups.size === 1 && axisGroups.has(DEFAULT_Y_AXIS_ID);
      const domainMax =
        usesDefaultOnly && yScaleDomainMax != null
          ? yScaleDomainMax
          : undefined;
      return resolveTimeSeriesYDomain(sourceData, dataKeys, domainMax);
    },
    [lines, yScaleDomainMax]
  );

  const skeletonData = useMemo(() => {
    const primaryKey = lines[0]?.dataKey ?? "value";
    if (data.length === 0) {
      return generateChartSkeletonData({ dataKey: primaryKey });
    }
    return generateChartSkeletonFromTarget(data, primaryKey);
  }, [data, lines]);

  const phase = useChartPhaseOrchestrator({
    animationDuration,
    chartStatus,
    revealSignature,
    skeletonData,
    skipEnterReveal: staticPreview,
    targetData: data,
    yDomainTweenDuration,
  });

  useEffect(() => {
    onPhaseChange?.(phase.chartPhase);
  }, [onPhaseChange, phase.chartPhase]);

  const xAccessor = useCallback(
    (datum) => {
      const value = datum[xDataKey];
      return value instanceof Date ? value : new Date(value);
    },
    [xDataKey]
  );
  const bisectDate = useMemo(() => bisector(xAccessor).left, [xAccessor]);
  const visiblePlotData = useMemo(() => {
    if (!xDomain) return phase.plotData;
    return filterDataByXDomain(phase.plotData, xDomain, xAccessor);
  }, [phase.plotData, xDomain, xAccessor]);
  const projectionConfigs = useMemo(
    () => extractProjectionLineConfigs(children),
    [children]
  );
  const xScale = useMemo(() => {
    const minTime = xDomain
      ? xDomain[0].getTime()
      : (extent(phase.plotData, (datum) => xAccessor(datum).getTime())[0] ?? 0);
    let maxTime = xDomain
      ? xDomain[1].getTime()
      : (extent(phase.plotData, (datum) => xAccessor(datum).getTime())[1] ??
        minTime);
    // Brush defines the viewport; projection horizon is included via its track.
    if (!xDomain) {
      maxTime = mergeProjectionXDomainMax(maxTime, projectionConfigs);
    }

    return scaleTime({ range: [0, innerWidth], domain: [minTime, maxTime] });
  }, [innerWidth, phase.plotData, projectionConfigs, xAccessor, xDomain]);

  // Preserve edge fades while brushing; interaction and domains use visible data.
  const seriesSourceData = xDomain ? phase.plotData : visiblePlotData;
  const renderData = useMemo(
    () =>
      decimateTimeSeries(
        seriesSourceData,
        maxRenderPointsForWidth(innerWidth),
        lines.map((line) => line.dataKey)
      ),
    [seriesSourceData, innerWidth, lines]
  );
  const columnWidth = useMemo(() => {
    const slotCount =
      xDomain && xDomainSlotCount != null
        ? xDomainSlotCount
        : visiblePlotData.length;
    if (slotCount < 2) return 0;
    return innerWidth / (slotCount - 1);
  }, [innerWidth, visiblePlotData.length, xDomain, xDomainSlotCount]);

  const yDomainSkeletonByAxis = useMemo(
    () =>
      computeYDomainsByAxis({
        lines,
        resolveDomain: (dataKeys) => resolveYDomain(skeletonData, dataKeys),
      }),
    [lines, resolveYDomain, skeletonData]
  );
  const yDomainTargetByAxis = useMemo(() => {
    const base = computeYDomainsByAxis({
      lines,
      resolveDomain: (dataKeys) =>
        resolveYDomain(xDomain ? visiblePlotData : data, dataKeys),
    });
    if (projectionConfigs.length === 0) return base;

    const merged = { ...base };
    for (const axisId of Object.keys(base)) {
      merged[axisId] = mergeProjectionYDomain(
        base[axisId] ?? [0, 100],
        projectionConfigs,
        axisId
      );
    }
    for (const config of projectionConfigs) {
      if (!merged[config.yAxisId]) {
        merged[config.yAxisId] = mergeProjectionYDomain(
          [0, 100],
          projectionConfigs,
          config.yAxisId
        );
      }
    }
    return merged;
  }, [data, lines, projectionConfigs, resolveYDomain, visiblePlotData, xDomain]);

  const animatedYDomainsByAxis = useAnimatedYDomains({
    chartPhase: phase.chartPhase,
    durationMs: yDomainTweenDuration,
    enabled: yDomainTween,
    onSettled: phase.notifyYDomainTweenComplete,
    skeletonByAxis: yDomainSkeletonByAxis,
    targetByAxis: yDomainTargetByAxis,
    tweenOnTargetChange:
      yDomainTween || (tweenYDomainOnXDomainChange && xDomain != null),
  });
  const yScales = useMemo(
    () =>
      buildYScalesFromDomains({
        domainsByAxis: animatedYDomainsByAxis,
        innerHeight,
        lines,
      }),
    [animatedYDomainsByAxis, innerHeight, lines]
  );
  const yScale = getPrimaryYScale(
    yScales,
    scaleLinear({ range: [innerHeight, 0], domain: [0, 100], nice: true })
  );
  const dateLabels = useMemo(() => {
    // Keep labels aligned with tooltip hit-testing, including projected points.
    const combined = buildCombinedData(
      visiblePlotData,
      projectionConfigs,
      xAccessor
    );
    return (combined ?? visiblePlotData).map((datum) =>
      shortDateFmt.format(xAccessor(datum))
    );
  }, [visiblePlotData, projectionConfigs, xAccessor]);

  return {
    ...phase,
    bisectDate,
    columnWidth,
    dateLabels,
    isInteractionPhase: isChartInteractionPhase(phase.chartPhase),
    projectionConfigs,
    renderData,
    visiblePlotData,
    xAccessor,
    xScale,
    yDomainSkeletonByAxis,
    yDomainTargetByAxis,
    yScale,
    yScales,
  };
}
