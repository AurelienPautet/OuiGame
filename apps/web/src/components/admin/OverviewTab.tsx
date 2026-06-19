import { useState } from "react";
import {
  Users,
  ShieldCheck,
  Activity,
  UserPlus,
  Gamepad2,
  Swords,
  Crosshair,
  Trophy,
  Crown,
  Map,
  Flag,
  Star,
  Award,
  CheckCircle2,
  LogIn,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { useAdminOverview, useAdminTimeseries } from "../../hooks/api";
import { palette } from "../../theme/palette";
import {
  DarkPanel,
  Panel,
  SegmentedControl,
  SectionLabel,
} from "../ui/primitives";
import { StatCard, type StatTone } from "./StatCard";
import { LineChart, BarChart } from "./charts";

type Days = "7" | "30" | "90";

const DAY_OPTIONS: { value: Days; label: string }[] = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
];

// One headline KPI tile spec. Resolved against the overview DTO below.
interface Kpi {
  label: string;
  value: string | number;
  hint?: string;
  tone: StatTone;
  icon: LucideIcon;
}

// Format a 0..1 float as a whole-percent string ("0.642" → "64%").
const pct = (ratio: number) => `${Math.round((ratio || 0) * 100)}%`;

const iconNode = (Icon: LucideIcon) => <Icon size={20} strokeWidth={2.5} />;

export function OverviewTab() {
  const [days, setDays] = useState<Days>("30");
  const { data: overview, isLoading: overviewLoading } = useAdminOverview();
  const { data: timeseries = [], isLoading: seriesLoading } =
    useAdminTimeseries(Number(days));

  // The charts take loosely-typed rows (Record<string, string|number>); the
  // timeseries points already match that shape, so they pass straight through.
  const chartData = timeseries as Array<Record<string, string | number>>;

  const kpis: Kpi[] = overview
    ? [
        {
          label: "Total Players",
          value: overview.players.total,
          hint: `${overview.players.db} db · ${overview.players.google} google`,
          tone: "blue",
          icon: Users,
        },
        {
          label: "Admins",
          value: overview.players.admins,
          tone: "purple",
          icon: ShieldCheck,
        },
        {
          label: "Active (7d)",
          value: overview.players.active7d,
          hint: `${overview.players.activeToday} today`,
          tone: "teal",
          icon: Activity,
        },
        {
          label: "New Users (7d)",
          value: overview.players.new7d,
          hint: `${overview.players.newToday} today`,
          tone: "green",
          icon: UserPlus,
        },
        {
          label: "Total Games",
          value: overview.games.total,
          tone: "blue",
          icon: Gamepad2,
        },
        {
          label: "Online Rounds",
          value: overview.games.onlineRounds,
          tone: "orange",
          icon: Globe,
        },
        {
          label: "Solo Rounds",
          value: overview.games.soloRounds,
          tone: "teal",
          icon: Gamepad2,
        },
        {
          label: "Campaign Runs",
          value: overview.games.campaignRuns,
          tone: "purple",
          icon: Flag,
        },
        {
          label: "Total Kills",
          value: overview.combat.kills,
          tone: "red",
          icon: Swords,
        },
        {
          label: "Total Wins",
          value: overview.combat.wins,
          tone: "yellow",
          icon: Trophy,
        },
        {
          label: "Accuracy",
          value: pct(overview.combat.accuracy),
          hint: "hits / shots",
          tone: "orange",
          icon: Crosshair,
        },
        {
          label: "Levels",
          value: `${overview.content.levelsUp} / ${overview.content.levels}`,
          hint: "published / total",
          tone: "green",
          icon: Map,
        },
        {
          label: "Campaigns",
          value: overview.content.campaigns,
          tone: "purple",
          icon: Flag,
        },
        {
          label: "Ratings",
          value: overview.content.ratings,
          tone: "yellow",
          icon: Star,
        },
        {
          label: "Achievements",
          value: overview.achievements.unlocked,
          hint: "unlocked",
          tone: "orange",
          icon: Award,
        },
        {
          label: "Solo Completion",
          value: pct(overview.solo.completionRate),
          hint: `${overview.solo.completions} / ${overview.solo.attempts}`,
          tone: "teal",
          icon: CheckCircle2,
        },
        {
          label: "Campaign Completion",
          value: pct(overview.campaignsStats.completionRate),
          hint: `${overview.campaignsStats.completions} / ${overview.campaignsStats.runs}`,
          tone: "green",
          icon: Crown,
        },
        {
          label: "Login Success",
          value: pct(overview.logins.successRate),
          hint: `${overview.logins.failed} failed`,
          tone: "blue",
          icon: LogIn,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* Header + window picker */}
      <div className="flex items-center justify-between gap-3.5 flex-wrap">
        <SectionLabel>Dashboard Overview</SectionLabel>
        <SegmentedControl<Days>
          tone="yellow"
          value={days}
          onValueChange={setDays}
          options={DAY_OPTIONS}
          aria-label="Time window"
        />
      </div>

      {/* KPI grid */}
      {overviewLoading ? (
        <KpiSkeleton />
      ) : kpis.length === 0 ? (
        <Panel className="px-4 py-8 text-center text-sm font-semibold text-ink-soft">
          No overview data available.
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {kpis.map((k) => (
            <StatCard
              key={k.label}
              label={k.label}
              value={k.value}
              {...(k.hint ? { hint: k.hint } : {})}
              tone={k.tone}
              icon={iconNode(k.icon)}
            />
          ))}
        </div>
      )}

      {/* Activity timeseries */}
      <ChartCard
        title="Activity"
        subtitle={`Last ${days} days`}
        loading={seriesLoading}
        empty={chartData.length === 0}
      >
        <LineChart
          data={chartData}
          xKey="date"
          area
          series={[
            { key: "games", label: "Games", color: palette.blue },
            { key: "newUsers", label: "New Users", color: palette.green },
            {
              key: "activeUsers",
              label: "Active Users",
              color: palette.purple,
            },
          ]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily kills */}
        <ChartCard
          title="Kills"
          subtitle="Per day"
          loading={seriesLoading}
          empty={chartData.length === 0}
        >
          <LineChart
            data={chartData}
            xKey="date"
            area
            series={[{ key: "kills", label: "Kills", color: palette.red }]}
          />
        </ChartCard>

        {/* Logins, with failed overlaid */}
        <ChartCard
          title="Logins"
          subtitle="Per day"
          loading={seriesLoading}
          empty={chartData.length === 0}
        >
          <BarChart
            data={chartData}
            xKey="date"
            barKey="logins"
            color={palette.teal}
          />
          <div className="mt-2 -mb-1">
            <LineChart
              data={chartData}
              xKey="date"
              height={120}
              series={[
                {
                  key: "failedLogins",
                  label: "Failed Logins",
                  color: palette.red,
                },
              ]}
            />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// --- Local presentation helpers ----------------------------------------------

interface ChartCardProps {
  title: string;
  subtitle: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}

/** A titled dark panel wrapping a bespoke SVG chart, with its own loading
 *  and empty states so a slow/blank timeseries reads on-brand. */
function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  children,
}: ChartCardProps) {
  return (
    <DarkPanel className="p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="font-display font-bold text-lg text-white">{title}</h3>
        <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
          {subtitle}
        </span>
      </div>
      {/* Charts draw ink-soft text on light fills, so sit them on a light card. */}
      <div className="bg-white border-[3px] border-ink rounded-xl p-3">
        {loading ? (
          <div className="flex items-center justify-center h-[220px] text-sm font-semibold text-ink-soft">
            Loading…
          </div>
        ) : empty ? (
          <div className="flex items-center justify-center h-[220px] text-sm font-semibold text-ink-soft">
            No data yet
          </div>
        ) : (
          children
        )}
      </div>
    </DarkPanel>
  );
}

/** Placeholder grid of muted cards while the overview KPIs load. */
function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="h-[78px] bg-white/60 border-4 border-ink/30 rounded-arcade animate-pulse"
        />
      ))}
    </div>
  );
}
