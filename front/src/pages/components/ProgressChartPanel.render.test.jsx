import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/charts/chart-context', () => ({
  useChartStable: () => ({ xScale: () => 0, xAccessor: () => 0 }),
  useYScale: () => () => 0,
}))
vi.mock('@/components/charts/projection-line', () => ({ default: () => null }))
vi.mock('@/components/charts/line-chart', () => ({
  default: ({ children }) => <div>{children}</div>,
}))
vi.mock('@/components/charts/line', () => ({ default: () => null }))
vi.mock('@/components/charts/grid', () => ({ default: () => null }))
vi.mock('@/components/charts/x-axis', () => ({ default: () => null }))
vi.mock('@/components/charts/y-axis', () => ({ default: () => null }))
vi.mock('@/components/charts/tooltip/chart-tooltip', () => ({
  default: () => null,
}))

import ProgressChartPanel from './ProgressChartPanel'

describe('ProgressChartPanel render', () => {
  it('renders the chart legend', () => {
    render(
      <ProgressChartPanel
        bestTimeChartPoint={null}
        bestTimePoint={null}
        category="Push"
        chartData={[]}
        chartMetric="volume"
        chartScrollMax={0}
        chartScrollPosition={0}
        chartScrollRef={{ current: null }}
        chartStroke="#000"
        forecastData={[]}
        graphScrollable={false}
        handleChartSliderChange={vi.fn()}
        isMobile={false}
        isPredicting={false}
        metricLabel="Volume"
        predictionError=""
        predictions={[]}
        progressLength={0}
        showForecast={false}
      />
    )

    expect(screen.getByText('Actual volume')).toBeTruthy()
  })
})
