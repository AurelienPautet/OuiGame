import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useModal } from "../../contexts";
import { TANK_COLORS as COLORS } from "../../constants/tankColors";
import { storage } from "../../lib/storage";
import { tankColors } from "../../theme/palette";
import { ui } from "../../audio";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  TankAvatar,
} from "../ui/primitives";
import { cn } from "../../lib/cn";

const clampIndex = (saved: number | null) =>
  Math.max(0, Math.min(saved ?? 1, COLORS.length - 1));

// A single-select colour picker. Semantically a radio group (one swatch chosen
// per row), and — like the shared Button/IconButton primitives — every pick is
// routed through `ui.click()` so it gives the same procedural audio feedback.
// Keyboard: roving tabindex with arrow keys, the standard radiogroup pattern.
const SwatchRow = ({
  label,
  selected,
  onPick,
}: {
  label: string;
  selected: number;
  onPick: (i: number) => void;
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (i: number) => {
    ui.click();
    onPick(i);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = COLORS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown")
      next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = i === 0 ? last : i - 1;
    if (next === null) return;
    e.preventDefault();
    pick(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-2 flex-wrap"
    >
      <span className="text-sm font-semibold text-ink w-16">{label}</span>
      {COLORS.map((name, i) => (
        <button
          key={name}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-label={name}
          aria-checked={i === selected}
          tabIndex={i === selected ? 0 : -1}
          onClick={() => pick(i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className={cn(
            "size-8 rounded-lg border-[3px] border-ink cursor-pointer transition-transform shadow-[0_3px_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/25",
            i === selected &&
              "outline-3 outline-white -outline-offset-[7px] -translate-y-0.5 scale-110"
          )}
          style={{ background: tankColors(name).fill }}
        />
      ))}
    </div>
  );
};

export const TankSelectModal = () => {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [bodyIndex, setBodyIndex] = useState(() =>
    clampIndex(storage.getBodyIndex())
  );
  const [turretIndex, setTurretIndex] = useState(() =>
    clampIndex(storage.getTurretIndex())
  );

  const handleSave = () => {
    // Indices are always clamped to [0, COLORS.length - 1].
    storage.setTankColors(
      bodyIndex,
      turretIndex,
      COLORS[bodyIndex]!,
      COLORS[turretIndex]!
    );
    closeModal();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
    >
      <DialogContent widthClassName="w-[min(94vw,520px)]">
        <DialogTitle className="text-2xl font-bold mb-4">
          {t("tankSelect.title")}
        </DialogTitle>

        <div className="graph-paper border-[3px] border-ink rounded-arcade flex items-center justify-center py-6 mb-5">
          <TankAvatar
            bodyColor={COLORS[bodyIndex] ?? "orange"}
            turretColor={COLORS[turretIndex] ?? "orange"}
            size={170}
          />
        </div>

        <div className="space-y-3 mb-5">
          <SwatchRow
            label={t("tankSelect.body")}
            selected={bodyIndex}
            onPick={setBodyIndex}
          />
          <SwatchRow
            label={t("tankSelect.turret")}
            selected={turretIndex}
            onPick={setTurretIndex}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={closeModal}>
            {t("common.cancel")}
          </Button>
          <Button variant="green" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
