import { curveLinear } from '@visx/curve'
import { formatDuration } from '../../utils/duration'
import { EXERCISE_CATEGORIES } from '../../utils/exerciseCategory'
import { useChartStable, useYScale } from '@/components/charts/chart-context'
import ProjectionLine from '@/components/charts/projection-line'
import LineChart from '@/components/charts/line-chart'
import Line from '@/components/charts/line'
import Grid from '@/components/charts/grid'
import XAxis from '@/components/charts/x-axis'
import YAxis from '@/components/charts/y-axis'
import ChartTooltip from '@/components/charts/tooltip/chart-tooltip'

function BestTimeMarker({ point, color }) {
  const { xScale, xAccessor } = useChartStable()
  const yScale = useYScale()

  if (!point) return null

  const x = xScale(xAccessor(point))
  const y = yScale(point.actualValue)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  return (
    <g transform={`translate(${x}, ${y})`} aria-hidden="true" pointerEvents="none">
      <circle r="8" fill={color} stroke="white" strokeWidth="3" />
    </g>
  )
}

BestTimeMarker.__isPostOverlay = true

export default function ProgressChartPanel({
  bestTimeChartPoint,
  bestTimePoint,
  category,
  chartData,
  chartMetric,
  chartScrollMax,
  chartScrollPosition,
  chartScrollRef,
  chartStroke,
  forecastData,
  graphScrollable,
  handleChartSliderChange,
  isMobile,
  isPredicting,
  metricLabel,
  predictionError,
  predictions,
  progressLength,
  showForecast,
}) {
  const renderChart = () => (
    <LineChart
      data={chartData}
      xDataKey="date"
      animationDuration={1800}
      animationEasing="cubic-bezier(0.42, 0, 1, 1)"
      key={chartMetric}
      style={{ touchAction: isMobile && graphScrollable && !showForecast ? 'pan-x' : 'none' }}
    >
      <Grid horizontal vertical intervalDays={4} />
      <Line dataKey="actualValue" stroke={chartStroke} curve={curveLinear} fadeEdges showHighlight={true} showMarkers />
      {category === EXERCISE_CATEGORIES.CARDIO && (
        <BestTimeMarker point={bestTimeChartPoint} color={chartStroke} />
      )}
      {showForecast && predictions.length > 0 && (
        <ProjectionLine data={forecastData} dataKey="value" curveKind="linear" showEndMarker={false} stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="6,4" showMarkers={true} />
      )}
      <YAxis
        formatLargeNumbers={false}
        formatValue={category === EXERCISE_CATEGORIES.CARDIO ? (value) => formatDuration(Math.abs(value)) : undefined}
      />
      <XAxis tickMode="interval" intervalDays={4} />
      <ChartTooltip
        backgroundColor="var(--tooltip-bg)"
        animateCrosshair={false}
        indicatorFadeEdges="none"
        rows={(point) => {
          const value = point.value ?? point.actualValue ?? 0
          return [{
            label: metricLabel,
            value: category === EXERCISE_CATEGORIES.CARDIO ? formatDuration(Math.abs(value)) : value,
            color: chartStroke,
          }]
        }}
      />
    </LineChart>
  )

  return (
    <div className="chart-box">
      {category === EXERCISE_CATEGORIES.CARDIO && bestTimePoint && (
        <p className="best-time-summary">
          <span>Best time</span>
          <strong>{formatDuration(bestTimePoint.duration)}</strong>
        </p>
      )}
      {isMobile && graphScrollable ? (
        <>
          <div className="chart-scroll-wrapper" ref={chartScrollRef} data-swipe-ignore>
            <div style={{ width: `${Math.max(800, progressLength * 45)}px`, height: '400px' }}>
              {renderChart()}
            </div>
          </div>
          {chartScrollMax > 0 && (
            <div className="chart-scroll-control" data-swipe-ignore>
              <input
                type="range"
                min="0"
                max={chartScrollMax}
                step="1"
                value={Math.min(chartScrollPosition, chartScrollMax)}
                onChange={handleChartSliderChange}
                aria-label="Scroll progress chart horizontally"
              />
            </div>
          )}
        </>
      ) : (
        renderChart()
      )}

      <div className="chart-footer">
        <div className="chart-legend" aria-label="Chart legend">
          <span className="legend-item">
            <span className="legend-line actual-line" />
            Actual {metricLabel.toLowerCase()}
          </span>
          {showForecast && (
            <span className="legend-item">
              <span className="legend-line forecast-line" />
              Forecast
            </span>
          )}
        </div>
        {isPredicting && <p className="status-message">Generating forecast...</p>}
        {predictionError && <p className="status-message error-message">{predictionError}</p>}
      </div>
    </div>
  )
}
