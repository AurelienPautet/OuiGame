import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "../../../lib/cn";
import { palette } from "../../../theme/palette";
import { echarts } from "./echarts-setup";
import {
  BASE_AXIS_LABEL,
  BASE_AXIS_LINE,
  BASE_SPLIT_LINE,
  CHART_FONTS,
  formatArcadeTooltip,
} from "./chartUtils";
import type { LineChartSeries } from "./LineChart";

export interface BarChartSeries {
  key: string;
  label?: string;
  color: string;
}

export interface BarChartProps {
  data: Array<Record<string, string | number>>;
  /** Key into each row for the x-axis category label. */
  xKey: string;
  /** Key into each row for the bar's numeric value (legacy single-series shorthand). */
  barKey?: string;
  /** Bar fill colour (hex) for legacy single-series shorthand. */
  color?: string;
  /** Multi-bar series support. */
  series?: BarChartSeries[];
  /** Optional overlaid line series (e.g. failed logins). */
  lineSeries?: LineChartSeries[];
  height?: number;
  /** Enable scroll & mouse-wheel zooming. Default true. */
  zoomable?: boolean;
  /** Show the bottom timeline slider control. Default false. */
  showSlider?: boolean;
}

export function BarChart({
  data,
  xKey,
  barKey,
  color = palette.teal,
  series: seriesProp,
  lineSeries = [],
  height = 220,
  zoomable = true,
  showSlider = false,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Normalize single barKey or multiple series
  const barSeries: BarChartSeries[] =
    seriesProp && seriesProp.length > 0
      ? seriesProp
      : barKey
        ? [{ key: barKey, color, label: barKey }]
        : [];

  const allSeriesLabels = [
    ...barSeries.map((s) => ({ label: s.label || s.key, color: s.color })),
    ...lineSeries.map((s) => ({ label: s.label, color: s.color })),
  ];

  if (data.length === 0 || barSeries.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm font-semibold text-ink-soft"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const xCategories = data.map((d) => String(d[xKey] ?? ""));

  useEffect(() => {
    if (!containerRef.current) return;

    const initialWidth = containerRef.current.clientWidth || 600;
    const initialHeight = containerRef.current.clientHeight || height;

    const chart = echarts.init(containerRef.current, undefined, {
      renderer: "svg",
      width: initialWidth,
      height: initialHeight,
    });
    chartRef.current = chart;

    chart.on("datazoom", () => {
      const opt = chart.getOption() as any;
      const zoom = opt?.dataZoom?.[0];
      if (zoom) {
        const active =
          (zoom.start != null && zoom.start > 0) ||
          (zoom.end != null && zoom.end < 100);
        setIsZoomed(Boolean(active));
      }
    });

    const handleResize = () => {
      chart.resize();
    };

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const echartsSeries: any[] = [
      ...barSeries.map((s) => ({
        name: s.label || s.key,
        type: "bar",
        data: data.map((row) => Number(row[s.key]) || 0),
        barMaxWidth: 30,
        itemStyle: {
          color: s.color,
          borderColor: palette.ink,
          borderWidth: 2,
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            borderColor: palette.ink,
            borderWidth: 2.5,
            shadowBlur: 0,
          },
        },
      })),
      ...lineSeries.map((s) => ({
        name: s.label,
        type: "line",
        data: data.map((row) => Number(row[s.key]) || 0),
        smooth: 0.15,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          color: s.color,
          width: 3,
          cap: "round",
          join: "round",
        },
        itemStyle: {
          color: s.color,
          borderColor: palette.ink,
          borderWidth: 2,
        },
        emphasis: {
          scale: 1.5,
        },
      })),
    ];

    const dataZoom: any[] = zoomable
      ? [
          {
            type: "inside",
            xAxisIndex: 0,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
          },
          ...(showSlider
            ? [
                {
                  type: "slider",
                  xAxisIndex: 0,
                  height: 16,
                  bottom: 2,
                  borderColor: palette.ink,
                  backgroundColor: "#f1f3f5",
                  fillerColor: "rgba(0, 178, 225, 0.18)",
                  handleStyle: {
                    color: palette.blue,
                    borderColor: palette.ink,
                    borderWidth: 2,
                  },
                  moveHandleStyle: {
                    color: palette.ink,
                  },
                  textStyle: {
                    color: palette.inkSoft,
                    fontFamily: CHART_FONTS,
                    fontWeight: 600,
                    fontSize: 9,
                  },
                },
              ]
            : []),
        ]
      : [];

    chart.setOption(
      {
        animation: true,
        animationDuration: 300,
        grid: {
          left: 42,
          right: 16,
          top: 14,
          bottom: showSlider ? 36 : 24,
        },
        tooltip: {
          trigger: "axis",
          backgroundColor: palette.panelDark,
          borderColor: palette.ink,
          borderWidth: 2,
          padding: [8, 12],
          extraCssText:
            "border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 3px 0 rgba(0,0,0,0.2); pointer-events: none;",
          formatter: formatArcadeTooltip,
          axisPointer: {
            type: "shadow",
            shadowStyle: {
              color: "rgba(43, 47, 54, 0.08)",
            },
          },
        },
        xAxis: {
          type: "category",
          data: xCategories,
          boundaryGap: true,
          axisLine: BASE_AXIS_LINE,
          axisTick: { show: false },
          axisLabel: {
            ...BASE_AXIS_LABEL,
            interval: "auto",
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          minInterval: 1,
          axisLine: BASE_AXIS_LINE,
          axisTick: { show: false },
          axisLabel: BASE_AXIS_LABEL,
          splitLine: BASE_SPLIT_LINE,
        },
        dataZoom,
        series: echartsSeries,
      },
      { notMerge: false }
    );
  }, [data, barSeries, lineSeries, zoomable, showSlider, xCategories]);

  const toggleSeries = (label: string) => {
    if (!chartRef.current) return;
    chartRef.current.dispatchAction({
      type: "legendToggleSelect",
      name: label,
    });
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    chartRef.current?.dispatchAction({
      type: "dataZoom",
      start: 0,
      end: 100,
    });
    setIsZoomed(false);
  };

  const showLegend = allSeriesLabels.length > 1;

  return (
    <div className="relative">
      {/* Zoom reset badge */}
      {isZoomed && (
        <button
          type="button"
          onClick={handleResetZoom}
          className="absolute top-1.5 right-2 z-10 flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-ink bg-white/95 hover:bg-white border-2 border-ink rounded-lg shadow-sm transition-all"
        >
          <RotateCcw size={11} strokeWidth={2.5} />
          Reset zoom
        </button>
      )}

      {/* Chart container */}
      <div
        ref={containerRef}
        style={{ height, width: "100%" }}
        onDoubleClick={handleResetZoom}
        title="Scroll or pinch to zoom · Drag to pan · Double-click to reset"
      />

      {/* Interactive Arcade Legend if multiple series */}
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {allSeriesLabels.map((s) => {
            const isHidden = hiddenSeries.has(s.label);
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => toggleSeries(s.label)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none transition-all",
                  isHidden
                    ? "opacity-35 line-through text-ink-soft/60"
                    : "text-ink-soft hover:text-ink"
                )}
                title={isHidden ? `Show ${s.label}` : `Hide ${s.label}`}
              >
                <span
                  className={cn(
                    "size-3 rounded-full border-2 border-ink transition-transform",
                    isHidden && "scale-75 opacity-50"
                  )}
                  style={{ background: s.color }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
