import { useState } from "react";
import { useModal } from "../../contexts";
import { TANK_COLORS as COLORS } from "../../constants/tankColors";
import { storage } from "../../lib/storage";
import { tankColors } from "../../theme/palette";
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

export const TankSelectModal = () => {
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

  const SwatchRow = ({
    label,
    selected,
    onPick,
  }: {
    label: string;
    selected: number;
    onPick: (i: number) => void;
  }) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-semibold text-ink w-16">{label}</span>
      {COLORS.map((name, i) => (
        <button
          key={name}
          type="button"
          aria-label={`${label} ${name}`}
          aria-pressed={i === selected}
          onClick={() => onPick(i)}
          className={cn(
            "size-8 rounded-lg border-[3px] border-ink cursor-pointer transition-transform shadow-[0_3px_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5",
            i === selected &&
              "outline-3 outline-white -outline-offset-[7px] -translate-y-0.5 scale-110"
          )}
          style={{ background: tankColors(name).fill }}
        />
      ))}
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) closeModal();
      }}
    >
      <DialogContent widthClassName="w-[min(94vw,520px)]">
        <DialogTitle className="text-2xl font-bold mb-4">Your Tank</DialogTitle>

        <div className="graph-paper border-[3px] border-ink rounded-arcade flex items-center justify-center py-6 mb-5">
          <TankAvatar
            bodyColor={COLORS[bodyIndex] ?? "orange"}
            turretColor={COLORS[turretIndex] ?? "orange"}
            size={170}
          />
        </div>

        <div className="space-y-3 mb-5">
          <SwatchRow label="Body" selected={bodyIndex} onPick={setBodyIndex} />
          <SwatchRow
            label="Turret"
            selected={turretIndex}
            onPick={setTurretIndex}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="green" onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
