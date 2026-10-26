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

export interface LineChartSeries {
  /** Key into each data row (numeric value). */
  key: string;
  /** Legend label. */
  label: string;
  /** Stroke / area colour (hex). */
  color: string;
}

export interface LineChartProps {
  data: Array<Record<string, string | number>>;
  /** Key into each row for the x-axis category (e.g. a date string). */
  xKey: string;
  series: LineChartSeries[];
  height?: number;
  /** Fill a faint area under each line. */
  area?: boolean;
  /** Enable scroll & mouse-wheel zooming. Default true. */
  zoomable?: boolean;
  /** Show the bottom timeline slider control. Default false. */
  showSlider?: boolean;
}

export function LineChart({
  data,
  xKey,
  series,
  height = 220,
  area = false,
  zoomable = true,
  showSlider = false,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Empty state fallback matching the original design
  if (data.length === 0 || series.length === 0) {
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

    // Track zoom state to toggle the Reset Zoom button
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

  // Update chart options whenever data, series, or configuration changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const isSinglePoint = data.length === 1;

    const echartsSeries: any[] = series.map((s) => ({
      name: s.label,
      type: "line",
      data: data.map((row) => Number(row[s.key]) || 0),
      smooth: 0.15,
      symbol: isSinglePoint ? "circle" : "emptyCircle",
      symbolSize: isSinglePoint ? 8 : 6,
      showSymbol: isSinglePoint,
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
        focus: "series",
        scale: 1.5,
        itemStyle: {
          color: s.color,
          borderColor: palette.ink,
          borderWidth: 2,
        },
      },
      ...(area && data.length > 1
        ? {
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: s.color + "44" },
                { offset: 1, color: s.color + "08" },
              ]),
            },
          }
        : {}),
    }));

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
            type: "line",
            lineStyle: {
              color: "rgba(43, 47, 54, 0.4)",
              width: 1.5,
              type: "dashed",
            },
            label: { show: false },
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
            interval: isSinglePoint ? 0 : "auto",
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
  }, [data, series, area, zoomable, showSlider, xCategories]);

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
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => {
          const isHidden = hiddenSeries.has(s.label);
          return (
            <button
              key={s.key}
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
    </div>
  );
}
