import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Keyboard, RotateCcw, Languages, Gamepad2 } from "lucide-react";
import { useModal, useSettings, MODALS } from "../../contexts";
import {
  KEY_PRESETS,
  keyLabel,
  matchPreset,
  type GameAction,
  type EffectSettings,
  type PresetName,
  type TouchControlsMode,
} from "../../lib/settings";
import { SUPPORTED_LANGUAGES } from "../../i18n";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Switch,
  SegmentedControl,
} from "../ui/primitives";
import { cn } from "../../lib/cn";

// Rebindable actions, in display order.
const ACTIONS: GameAction[] = ["up", "down", "left", "right", "plant"];

// Effect toggles, in display order (grouped roughly loudest→subtlest).
const EFFECTS: (keyof EffectSettings)[] = [
  "particles",
  "scenery",
  "bloom",
  "shockwaves",
  "screenShake",
  "flashes",
  "aberration",
  "vignette",
  "sound",
  "music",
];

// Preset → button label (the binding sets are physical-key based, so a French
// AZERTY board sees ZQSD where the codes say KeyZ/KeyQ).
const PRESET_LABELS: Record<PresetName, string> = {
  WASD: "WASD",
  ZQSD: "AZERTY",
  Arrows: "Arrows",
};

interface SettingsModalProps {
  /** Controlled open state (in-game). Omit to drive via ModalContext (menus). */
  open?: boolean;
  /** Called when the dialog requests close. Defaults to ModalContext.closeModal. */
  onClose?: () => void;
}

/**
 * Settings: rebind the movement/plant keys and toggle the visual/audio effects.
 * Changes apply (and persist) live — no Save button — so toggling an effect or
 * rebinding a key takes hold immediately, including mid-game.
 */
export const SettingsModal = ({ open, onClose }: SettingsModalProps) => {
  const { t, i18n } = useTranslation();
  const modal = useModal();
  const {
    settings,
    setKeybinding,
    applyPreset,
    setEffect,
    setTouchControls,
    setAutoFire,
    resetSettings,
  } = useSettings();

  const isOpen = open ?? modal.isOpen(MODALS.SETTINGS);
  const close = onClose ?? modal.closeModal;

  // Active language (base code, e.g. "fr-FR" → "fr") for highlighting the picker.
  const currentLang = (i18n.resolvedLanguage ?? i18n.language ?? "en").split(
    "-"
  )[0];

  // Which action (if any) is currently waiting for a key to be pressed.
  const [listeningFor, setListeningFor] = useState<GameAction | null>(null);

  // While listening, the next keydown becomes the binding. Gated on isOpen so
  // closing the dialog (which clears listeningFor via onOpenChange) tears the
  // global listener down. Capture-phase + stopPropagation so Esc cancels the
  // rebind (rather than closing the dialog) and game-level handlers don't see it.
  useEffect(() => {
    if (!listeningFor || !isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") setKeybinding(listeningFor, e.code);
      setListeningFor(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listeningFor, isOpen, setKeybinding]);

  const currentPreset = matchPreset(settings.keybindings);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) {
          setListeningFor(null);
          close();
        }
      }}
    >
      <DialogContent widthClassName="w-[min(94vw,540px)]">
        <DialogTitle className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Keyboard className="w-6 h-6" strokeWidth={2.5} />
          {t("settings.title")}
        </DialogTitle>

        {/* --- Language --- */}
        <div className="mb-6">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide text-ink-soft mb-3 flex items-center gap-1.5">
            <Languages className="w-4 h-4" strokeWidth={2.5} />
            {t("settings.language")}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_LANGUAGES.map((lng) => (
              <button
                key={lng.code}
                type="button"
                onClick={() => void i18n.changeLanguage(lng.code)}
                aria-pressed={currentLang === lng.code}
                className={cn(
                  "font-display font-semibold text-xs px-2.5 py-1.5 rounded-[9px] border-[3px] border-ink cursor-pointer transition-colors inline-flex items-center gap-1.5",
                  currentLang === lng.code
                    ? "bg-blue text-white"
                    : "bg-white text-ink hover:bg-[#f1f3f6]"
                )}
              >
                <span aria-hidden>{lng.flag}</span>
                {lng.label}
              </button>
            ))}
          </div>
        </div>

        {/* --- Controls --- */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-ink-soft">
              {t("settings.controls")}
            </h3>
            <div className="flex gap-1.5">
              {(Object.keys(KEY_PRESETS) as PresetName[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyPreset(name)}
                  aria-pressed={currentPreset === name}
                  className={cn(
                    "font-display font-semibold text-xs px-2.5 py-1.5 rounded-[9px] border-[3px] border-ink cursor-pointer transition-colors",
                    currentPreset === name
                      ? "bg-blue text-white"
                      : "bg-white text-ink hover:bg-[#f1f3f6]"
                  )}
                >
                  {PRESET_LABELS[name]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {ACTIONS.map((action) => {
              const listening = listeningFor === action;
              return (
                <div
                  key={action}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-semibold text-ink">
                    {t(`settings.actions.${action}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setListeningFor(action)}
                    className={cn(
                      "min-w-[96px] px-3 py-2 rounded-[10px] border-[3px] border-ink cursor-pointer font-display font-bold text-sm transition-colors",
                      listening
                        ? "bg-yellow text-ink animate-pulse"
                        : "bg-white text-ink hover:bg-[#f1f3f6]"
                    )}
                  >
                    {listening
                      ? t("settings.pressKey")
                      : keyLabel(settings.keybindings[action])}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-soft mt-2.5">
            {t("settings.aimNote")}
          </p>
        </div>

        {/* --- Touch controls --- */}
        <div className="mb-6">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide text-ink-soft mb-3 flex items-center gap-1.5">
            <Gamepad2 className="w-4 h-4" strokeWidth={2.5} />
            {t("settings.touch.title")}
          </h3>
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-sm font-semibold text-ink">
              {t("settings.touch.show")}
            </span>
            <SegmentedControl<TouchControlsMode>
              value={settings.touchControls}
              onValueChange={setTouchControls}
              aria-label={t("settings.touch.show")}
              options={[
                { value: "auto", label: t("settings.touch.modes.auto") },
                { value: "on", label: t("settings.touch.modes.on") },
                { value: "off", label: t("settings.touch.modes.off") },
              ]}
            />
          </div>
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="text-sm font-semibold text-ink">
              {t("settings.touch.autoFire")}
            </span>
            <Switch checked={settings.autoFire} onCheckedChange={setAutoFire} />
          </label>
        </div>

        {/* --- Effects --- */}
        <div className="mb-6">
          <h3 className="font-display font-bold text-sm uppercase tracking-wide text-ink-soft mb-3">
            {t("settings.effects")}
          </h3>
          <div className="space-y-2.5">
            {EFFECTS.map((effect) => (
              <label
                key={effect}
                className="flex items-center justify-between gap-3 cursor-pointer"
              >
                <span className="text-sm font-semibold text-ink">
                  {t(`settings.effectLabels.${effect}`)}
                </span>
                <Switch
                  checked={settings.effects[effect]}
                  onCheckedChange={(v) => setEffect(effect, v)}
                />
              </label>
            ))}
          </div>
        </div>

        {/* --- Footer --- */}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={resetSettings}>
            <RotateCcw className="w-4 h-4" />
            {t("settings.reset")}
          </Button>
          <Button variant="green" onClick={close}>
            {t("common.done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
