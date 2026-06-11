import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useModal } from "../../contexts";
import { TANK_COLORS as COLORS } from "../../constants/tankColors";
import { storage } from "../../lib/storage";
import { tankColors } from "../../theme/palette";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  RadioGroup,
  TankAvatar,
} from "../ui/primitives";
import { cn } from "../../lib/cn";

const clampIndex = (saved: number | null) =>
  Math.max(0, Math.min(saved ?? 1, COLORS.length - 1));

// A single-select colour picker, built on the shared RadioGroup primitive so it
// gets the arcade click sound + radiogroup keyboard/ARIA for free (the swatches
// used to be bare <button>s that bypassed the audio system entirely). State is
// the persisted colour index; we map to/from the colour name at the boundary.
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
    <RadioGroup
      aria-label={label}
      value={COLORS[selected] ?? COLORS[0]!}
      options={COLORS}
      onValueChange={(name) => onPick(COLORS.indexOf(name))}
      className="flex items-center gap-2 flex-wrap"
      optionStyle={(name) => ({ background: tankColors(name).fill })}
      optionClassName={(_name, checked) =>
        cn(
          "size-8 rounded-lg border-[3px] border-ink transition-transform shadow-[0_3px_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5",
          checked &&
            "outline-3 outline-white -outline-offset-[7px] -translate-y-0.5 scale-110"
        )
      }
    />
  </div>
);

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
