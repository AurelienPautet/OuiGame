import * as echarts from "echarts/core";
import { LineChart as ELineChart, BarChart as EBarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AxisPointerComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  ELineChart,
  EBarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  AxisPointerComponent,
  SVGRenderer,
]);

export { echarts };
