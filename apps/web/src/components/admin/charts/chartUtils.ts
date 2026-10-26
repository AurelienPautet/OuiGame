import { palette } from "../../../theme/palette";

export const CHART_FONTS =
  '"Fredoka Variable", "Fredoka", system-ui, -apple-system, sans-serif';

export const BASE_AXIS_LINE = {
  lineStyle: {
    color: palette.ink,
    width: 2,
  },
};

export const BASE_SPLIT_LINE = {
  lineStyle: {
    color: palette.fieldLine,
    width: 1,
    type: "solid" as const,
  },
};

export const BASE_AXIS_LABEL = {
  color: palette.inkSoft,
  fontFamily: CHART_FONTS,
  fontWeight: 600,
  fontSize: 10,
  margin: 8,
};

/** Format tooltip content using OuiGame's dark arcade panel styling. */
export function formatArcadeTooltip(params: any): string {
  const items = Array.isArray(params) ? params : [params];
  if (items.length === 0) return "";

  const title = items[0].axisValueLabel || items[0].name || "";

  const rows = items
    .filter((it: any) => it.value !== undefined && it.value !== null)
    .map((it: any) => {
      const color = it.color?.colorStops
        ? it.color.colorStops[0].color
        : it.color || palette.blue;
      const val =
        typeof it.value === "number" ? it.value.toLocaleString() : it.value;
      const name = it.seriesName || "";

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; border: 1.5px solid #2b2f36;"></span>
            <span style="font-size: 12px; font-weight: 600; color: #b8bdc4;">${escapeHtml(name)}</span>
          </div>
          <span style="font-size: 13px; font-weight: 700; color: #ffffff;">${escapeHtml(String(val))}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family: ${CHART_FONTS}; min-width: 130px;">
      <div style="font-size: 12px; font-weight: 700; color: #ffffff; border-bottom: 1.5px solid rgba(255,255,255,0.15); padding-bottom: 4px; margin-bottom: 4px;">
        ${escapeHtml(title)}
      </div>
      ${rows}
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
