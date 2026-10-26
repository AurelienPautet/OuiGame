import { useEffect, useMemo, useRef, useState } from "react";
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

export interface LineChartSeries {
  /** Key in the data object for this series' numeric values. */
  key: string;
  /** Label shown in tooltip and legend. */
  label: string;
  /** Stroke colour (hex) for this line. */
  color: string;
}

export interface LineChartProps {
  data: Array<Record<string, string | number>>;
  /** Key into each row for the x-axis category label (e.g. "date"). */
  xKey: string;
  /** One or more numeric series to draw. */
  series: LineChartSeries[];
  /** Fill the area beneath each line with a soft gradient. Default false. */
  area?: boolean;
  height?: number;
  /** Enable scroll & mouse-wheel zooming. Default true. */
  zoomable?: boolean;
  /** Show the bottom timeline slider control. Default false. */
  showSlider?: boolean;
}

export function LineChart({
  data,
  xKey,
  series,
  area = false,
  height = 220,
  zoomable = true,
  showSlider = false,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const isEmpty = data.length === 0 || series.length === 0;

  const xCategories = useMemo(
    () => (isEmpty ? [] : data.map((d) => String(d[xKey] ?? ""))),
    [data, xKey, isEmpty]
  );

  useEffect(() => {
    if (!containerRef.current || isEmpty) return;

    const initialWidth = containerRef.current.clientWidth || 600;
    const initialHeight = containerRef.current.clientHeight || height;

    const chart = echarts.init(containerRef.current, undefined, {
      renderer: "svg",
      width: initialWidth,
      height: initialHeight,
    });
    chartRef.current = chart;

    chart.on("datazoom", () => {
      const opt = chart.getOption() as {
        dataZoom?: Array<{ start?: number; end?: number }>;
      };
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
  }, [height, isEmpty]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || isEmpty) return;

    const echartsSeries = series.map((s) => ({
      name: s.label,
      type: "line" as const,
      data: data.map((row) => Number(row[s.key]) || 0),
      smooth: 0.15,
      symbol: "circle",
      symbolSize: data.length === 1 ? 8 : 6,
      showSymbol: data.length === 1,
      lineStyle: {
        color: s.color,
        width: 3,
        cap: "round" as const,
        join: "round" as const,
      },
      itemStyle: {
        color: s.color,
        borderColor: palette.ink,
        borderWidth: 2,
      },
      emphasis: {
        scale: 1.6,
      },
      ...(area
        ? {
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color:
                    s.color.length === 7 ? `${s.color}40` : "rgba(0,0,0,0.2)",
                },
                {
                  offset: 1,
                  color:
                    s.color.length === 7 ? `${s.color}05` : "rgba(0,0,0,0)",
                },
              ]),
            },
          }
        : {}),
    }));

    const dataZoom = zoomable
      ? [
          {
            type: "inside" as const,
            xAxisIndex: 0,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
          },
          ...(showSlider
            ? [
                {
                  type: "slider" as const,
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
        legend: {
          show: false,
          data: series.map((s) => s.label),
        },
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
            type: "line",
            lineStyle: {
              color: palette.ink,
              width: 1.5,
              type: "dashed",
            },
          },
        },
        xAxis: {
          type: "category",
          data: xCategories,
          boundaryGap: false,
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
  }, [data, series, area, zoomable, showSlider, xCategories, isEmpty]);

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

  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center text-sm font-semibold text-ink-soft"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const showLegend = series.length > 1;

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

      {/* Interactive Arcade Legend */}
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => {
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
