import { cn } from "../../../lib/cn";

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
}

// Internal coordinate system — the SVG is responsive (width 100%) via viewBox,
// so these are virtual units, not pixels.
const VW = 600;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;
const GRID_LINES = 4;

/** Round a max value up to a clean axis bound (1 / 2 / 5 × 10ⁿ). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

export function LineChart({
  data,
  xKey,
  series,
  height = 220,
  area = false,
}: LineChartProps) {
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

  const rawMax = data.reduce((m, row) => {
    for (const s of series) m = Math.max(m, Number(row[s.key]) || 0);
    return m;
  }, 0);
  const max = niceMax(rawMax);

  const plotW = VW - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  // With a single point, place it at the left edge to avoid a divide-by-zero.
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  const xAt = (i: number) => PAD_L + i * stepX;
  const yAt = (v: string | number) => PAD_T + plotH - (Number(v) / max) * plotH;

  // Sparse x ticks: first / middle / last.
  const tickIdx = Array.from(
    new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])
  ).filter((i) => i >= 0 && i < data.length);

  const gridRows = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const v = (max / GRID_LINES) * i;
    return { v, y: yAt(v) };
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${VW} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label="Line chart"
      >
        {/* horizontal gridlines + y labels */}
        {gridRows.map((g) => (
          <g key={g.v}>
            <line
              x1={PAD_L}
              x2={VW - PAD_R}
              y1={g.y}
              y2={g.y}
              stroke="var(--color-field-line)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6}
              y={g.y + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--color-ink-soft)"
              fontWeight={600}
            >
              {Math.round(g.v)}
            </text>
          </g>
        ))}

        {/* ink baseline / y-axis */}
        <line
          x1={PAD_L}
          x2={VW - PAD_R}
          y1={PAD_T + plotH}
          y2={PAD_T + plotH}
          stroke="var(--color-ink)"
          strokeWidth={2}
        />
        <line
          x1={PAD_L}
          x2={PAD_L}
          y1={PAD_T}
          y2={PAD_T + plotH}
          stroke="var(--color-ink)"
          strokeWidth={2}
        />

        {/* series */}
        {series.map((s) => {
          const pts = data.map((row, i) => `${xAt(i)},${yAt(row[s.key] ?? 0)}`);
          const line = pts.join(" ");
          const areaPath =
            data.length > 1
              ? `M ${xAt(0)},${PAD_T + plotH} L ${pts.join(" L ")} L ${xAt(
                  data.length - 1
                )},${PAD_T + plotH} Z`
              : "";
          return (
            <g key={s.key}>
              {area && data.length > 1 && (
                <path d={areaPath} fill={s.color} opacity={0.12} />
              )}
              <polyline
                points={line}
                fill="none"
                stroke={s.color}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* single-point fallback: a dot so the value is visible */}
              {data.length === 1 && (
                <circle
                  cx={xAt(0)}
                  cy={yAt(data[0]?.[s.key] ?? 0)}
                  r={4}
                  fill={s.color}
                  stroke="var(--color-ink)"
                  strokeWidth={1.5}
                />
              )}
            </g>
          );
        })}

        {/* sparse x labels */}
        {tickIdx.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={height - 8}
            textAnchor={
              i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"
            }
            fontSize={10}
            fill="var(--color-ink-soft)"
            fontWeight={600}
          >
            {String(data[i]?.[xKey] ?? "")}
          </text>
        ))}
      </svg>

      {/* legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span
            key={s.key}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft"
            )}
          >
            <span
              className="size-3 rounded-full border-2 border-ink"
              style={{ background: s.color }}
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
