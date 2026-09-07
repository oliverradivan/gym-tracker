"use client";;

import { intFmt } from "../chart-formatters";

export function TooltipContent({
  title,
  rows,
  children
}) {
  return (
    <div className="overflow-hidden">
      <div className="px-3 py-2.5">
        {title && (
          <div className="mb-2 text-left font-medium text-chart-tooltip-foreground text-xs">
            {title}
          </div>
        )}
        <div className="space-y-1.5">
          {rows.map((row) => {
            const rowClassName = row.isForecast
              ? "text-chart-tooltip-muted"
              : "text-chart-tooltip-foreground";
            const valueStyle = row.isForecast
              ? { opacity: 0.7 }
              : undefined;

            return (
              <div
                className="flex items-center justify-between gap-4"
                key={`${row.label}-${row.color}`}
                style={row.isForecast ? { opacity: 0.7 } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className={rowClassName}>
                    {row.label}
                  </span>
                </div>
                <span className="font-medium text-chart-tooltip-foreground text-sm tabular-nums">
                  {typeof row.value === "number" ? intFmt(row.value) : row.value}
                </span>
              </div>
            );
          })}
        </div>

        {children && (
          <div className="mt-2 transition-opacity duration-200 ease-out">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

TooltipContent.displayName = "TooltipContent";

export default TooltipContent;