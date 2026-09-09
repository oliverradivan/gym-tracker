import { shortDateFmt } from "./chart-formatters";

/**
 * Generates fixed-interval date ticks (e.g. every 4 days), starting at the
 * first date in the x-scale's domain and stepping forward by `intervalDays`
 * until the domain end is passed. Ticks are NOT tied to where actual data
 * points fall — two data points 6 days apart still just get whatever ticks
 * land in that span, positioned date-proportionally via `xScale`.
 *
 * `Grid` (vertical lines) and `XAxis` (date labels) both call this with the
 * same `xScale` + `intervalDays`, so the dashed grid lines and the labels
 * underneath them are guaranteed to line up — and the first tick always
 * sits exactly at the domain start instead of wherever a heuristic tick
 * picker happened to land.
 */
export function buildIntervalTicks({ xScale, marginLeft = 0, intervalDays = 4 }) {
  const domain = xScale.domain();
  const startDate = domain[0];
  const endDate = domain[1];

  if (!(startDate && endDate)) {
    return [];
  }

  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const stepMs = intervalDays * 86_400_000;

  if (stepMs <= 0 || endTime <= startTime) {
    return [
      {
        date: startDate,
        label: shortDateFmt.format(startDate),
        x: (xScale(startDate) ?? 0) + marginLeft,
      },
    ];
  }

  const ticks = [];
  for (let t = startTime; t <= endTime; t += stepMs) {
    const date = new Date(t);
    ticks.push({
      date,
      label: shortDateFmt.format(date),
      x: (xScale(date) ?? 0) + marginLeft,
    });
  }

  return ticks;
}