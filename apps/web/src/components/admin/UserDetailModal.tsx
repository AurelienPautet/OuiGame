import {
  ShieldCheck,
  Swords,
  Skull,
  Target,
  Crosshair,
  Trophy,
  Hammer,
  Gamepad2,
  Flag,
  Layers,
  Medal,
  History,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAdminUser } from "../../hooks/api";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Chip,
  TankAvatar,
} from "../ui/primitives";
import { cn } from "../../lib/cn";
import { humanizeLabel } from "./labels";

// Locale date+time for the login log; plain date for created/rows.
const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString() : "—";
const fmtDateTime = (iso: string): string => new Date(iso).toLocaleString();

interface UserDetailModalProps {
  userId: number;
  onClose: () => void;
}

/**
 * Full-profile drawer for a single user: combat totals, recent logins, and the
 * levels / campaigns / achievements they own. Loads on open via useAdminUser.
 */
export const UserDetailModal = ({ userId, onClose }: UserDetailModalProps) => {
  const { data: user, isLoading, isError } = useAdminUser(userId);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        widthClassName="w-[min(94vw,820px)]"
        className="h-[82vh] flex flex-col overflow-hidden"
      >
        {isLoading ? (
          <div className="flex-1 grid place-items-center text-ink-soft font-semibold">
            Loading user…
          </div>
        ) : isError || !user ? (
          <div className="flex-1 grid place-items-center text-red font-bold">
            Couldn’t load this user.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-4 pr-10 shrink-0">
              <div className="bg-field border-[3px] border-ink rounded-2xl p-1.5 shrink-0">
                <TankAvatar bodyColor="blue" size={52} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-extrabold truncate flex items-center gap-2">
                  {user.username}
                  {user.isAdmin && (
                    <Chip
                      active
                      className="bg-green text-ink border-green-d pointer-events-none cursor-default"
                    >
                      <ShieldCheck size={14} className="mr-1 inline" />
                      Admin
                    </Chip>
                  )}
                </DialogTitle>
                <p className="text-ink-soft text-sm truncate">{user.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                  <span className="bg-field border-2 border-ink rounded-md px-1.5 py-0.5">
                    {user.type}
                  </span>
                  <span>Joined {fmtDate(user.createdAt)}</span>
                  <span>· Last seen {fmtDate(user.lastLoginAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-5">
              {/* Combat / activity stat grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <Stat
                  label="Online rounds"
                  value={user.onlineRounds}
                  icon={Gamepad2}
                  color="text-blue-d"
                />
                <Stat
                  label="Solo rounds"
                  value={user.soloRounds}
                  icon={Gamepad2}
                  color="text-purple"
                />
                <Stat
                  label="Wins"
                  value={user.wins}
                  icon={Trophy}
                  color="text-yellow-d"
                />
                <Stat
                  label="Kills"
                  value={user.kills}
                  icon={Swords}
                  color="text-red"
                />
                <Stat
                  label="Deaths"
                  value={user.deaths}
                  icon={Skull}
                  color="text-ink"
                />
                <Stat
                  label="Shots"
                  value={user.shots}
                  icon={Crosshair}
                  color="text-orange-d"
                />
                <Stat
                  label="Hits"
                  value={user.hits}
                  icon={Target}
                  color="text-blue-d"
                />
                <Stat
                  label="Accuracy"
                  value={`${Math.round(user.accuracy * 100)}%`}
                  icon={Target}
                  color="text-green"
                />
                <Stat
                  label="Blocks broken"
                  value={user.blocksDestroyed}
                  icon={Hammer}
                  color="text-yellow-d"
                />
                <Stat
                  label="Solo wins"
                  value={user.soloCompletions}
                  icon={Flag}
                  color="text-green"
                />
                <Stat
                  label="Campaign runs"
                  value={user.campaignRuns}
                  icon={Layers}
                  color="text-purple"
                />
                <Stat
                  label="Achievements"
                  value={user.achievements.length}
                  icon={Medal}
                  color="text-orange-d"
                />
              </div>

              {/* Recent logins */}
              <Section title="Recent logins" icon={History}>
                {user.recentLogins.length === 0 ? (
                  <Empty>No login history.</Empty>
                ) : (
                  <div className="overflow-hidden rounded-xl border-[3px] border-ink">
                    {user.recentLogins.map((l, i) => (
                      <div
                        key={`${l.at}-${i}`}
                        className="flex items-center gap-3 px-3 py-2 text-sm odd:bg-white even:bg-field/50"
                      >
                        <StatusBadge status={l.status} />
                        <span className="font-mono text-ink-soft truncate flex-1">
                          {l.ip}
                        </span>
                        <span className="text-ink-soft font-semibold whitespace-nowrap">
                          {fmtDateTime(l.at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Levels */}
              <Section title={`Levels (${user.levels.length})`} icon={Layers}>
                {user.levels.length === 0 ? (
                  <Empty>No levels created.</Empty>
                ) : (
                  <div className="overflow-hidden rounded-xl border-[3px] border-ink">
                    {user.levels.map((lvl) => (
                      <div
                        key={lvl.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm odd:bg-white even:bg-field/50"
                      >
                        <span className="font-bold text-ink truncate flex-1">
                          {lvl.name}
                        </span>
                        <span className="text-[11px] font-bold uppercase text-ink-soft">
                          {lvl.type}
                        </span>
                        <Chip
                          active
                          className={cn(
                            "pointer-events-none cursor-default text-xs px-2.5 py-0.5",
                            lvl.status === "up"
                              ? "bg-green text-ink border-green-d"
                              : "bg-red text-white border-red-d"
                          )}
                        >
                          {lvl.status === "up" ? "Published" : "Hidden"}
                        </Chip>
                        <span className="text-ink-soft whitespace-nowrap">
                          {fmtDate(lvl.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Campaigns */}
              <Section
                title={`Campaigns (${user.campaigns.length})`}
                icon={Flag}
              >
                {user.campaigns.length === 0 ? (
                  <Empty>No campaigns created.</Empty>
                ) : (
                  <div className="overflow-hidden rounded-xl border-[3px] border-ink">
                    {user.campaigns.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm odd:bg-white even:bg-field/50"
                      >
                        <span className="font-bold text-ink truncate flex-1">
                          {c.name}
                        </span>
                        <span className="text-ink-soft whitespace-nowrap">
                          {fmtDate(c.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Achievements */}
              <Section
                title={`Achievements (${user.achievements.length})`}
                icon={Medal}
              >
                {user.achievements.length === 0 ? (
                  <Empty>No achievements unlocked.</Empty>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {user.achievements.map((key) => (
                      <span
                        key={key}
                        className="bg-yellow text-ink border-2 border-ink rounded-full px-3 py-1 text-xs font-bold"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface StatProps {
  label: string;
  value: string | number;
  icon: typeof Swords;
  color: string;
}

const Stat = ({ label, value, icon: Icon, color }: StatProps) => (
  <div className="bg-field border-[3px] border-ink rounded-xl p-3 flex items-center gap-3">
    <div className="p-2 rounded-lg bg-white border-2 border-ink shrink-0">
      <Icon size={20} className={color} />
    </div>
    <div className="min-w-0">
      <div className="text-xl font-bold text-ink tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase text-ink-soft truncate">
        {label}
      </div>
    </div>
  </div>
);

const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Swords;
  children: ReactNode;
}) => (
  <div>
    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-soft mb-2">
      <Icon size={15} />
      {title}
    </h3>
    {children}
  </div>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <div className="text-sm text-ink-soft font-semibold bg-field/50 border-[3px] border-ink/30 rounded-xl px-3 py-3">
    {children}
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  // Colour decision stays on the raw enum string; only the text is humanised.
  const ok = status === "success";
  return (
    <span
      className={cn(
        "text-[11px] font-bold uppercase tracking-wide rounded-md px-2 py-0.5 border-2 whitespace-nowrap",
        ok
          ? "bg-green text-ink border-green-d"
          : "bg-red text-white border-red-d"
      )}
    >
      {humanizeLabel(status)}
    </span>
  );
};
