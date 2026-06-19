export interface BarChartProps {
  data: Array<Record<string, string | number>>;
  /** Key into each row for the x-axis category label. */
  xKey: string;
  /** Key into each row for the bar's numeric value. */
  barKey: string;
  /** Bar fill colour (hex). */
  color: string;
  height?: number;
}

// Responsive virtual coordinate system (width 100% via viewBox).
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

export function BarChart({
  data,
  xKey,
  barKey,
  color,
  height = 220,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm font-semibold text-ink-soft"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const rawMax = data.reduce(
    (m, row) => Math.max(m, Number(row[barKey]) || 0),
    0
  );
  const max = niceMax(rawMax);

  const plotW = VW - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;
  const slot = plotW / data.length;
  const barW = Math.max(2, slot * 0.62);

  const yAt = (v: number) => PAD_T + plotH - (Number(v) / max) * plotH;

  const gridRows = Array.from({ length: GRID_LINES + 1 }, (_, i) => {
    const v = (max / GRID_LINES) * i;
    return { v, y: yAt(v) };
  });

  // Sparse x ticks: first / middle / last.
  const tickIdx = Array.from(
    new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])
  ).filter((i) => i >= 0 && i < data.length);

  return (
    <svg
      viewBox={`0 0 ${VW} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Bar chart"
    >
      {/* gridlines + y labels */}
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

      {/* bars */}
      {data.map((row, i) => {
        const v = Number(row[barKey]) || 0;
        const x = PAD_L + i * slot + (slot - barW) / 2;
        const y = yAt(v);
        const h = PAD_T + plotH - y;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={Math.max(0, h)}
            rx={3}
            fill={color}
            stroke="var(--color-ink)"
            strokeWidth={2}
          />
        );
      })}

      {/* ink axes */}
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

      {/* sparse x labels */}
      {tickIdx.map((i) => (
        <text
          key={i}
          x={PAD_L + i * slot + slot / 2}
          y={height - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-ink-soft)"
          fontWeight={600}
        >
          {String(data[i]?.[xKey] ?? "")}
        </text>
      ))}
    </svg>
  );
}
