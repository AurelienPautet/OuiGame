import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  KEY_PRESETS,
  type Settings,
  type GameAction,
  type EffectSettings,
  type PresetName,
} from "../lib/settings";
import { applyKeyBindings } from "../engine/InputHandler";

interface SettingsContextValue {
  settings: Settings;
  setKeybinding: (action: GameAction, code: string) => void;
  applyPreset: (preset: PresetName) => void;
  setEffect: (effect: keyof EffectSettings, value: boolean) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};

/**
 * Holds the user's settings (keybindings + effect toggles), persists every
 * change to localStorage, and pushes the keybindings into the imperative input
 * layer so a remap takes effect immediately — even mid-game. Effect toggles are
 * applied to the running engine by GameCanvas (which owns the engine ref); they
 * live here only as state + persistence.
 */
export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  // Persist + push keybindings to the engine on every change (and on mount, so
  // the saved bindings are live before any game starts).
  useEffect(() => {
    saveSettings(settings);
    applyKeyBindings(settings.keybindings);
  }, [settings]);

  const setKeybinding = useCallback((action: GameAction, code: string) => {
    setSettings((prev) => ({
      ...prev,
      keybindings: { ...prev.keybindings, [action]: code },
    }));
  }, []);

  const applyPreset = useCallback((preset: PresetName) => {
    setSettings((prev) => ({
      ...prev,
      keybindings: { ...KEY_PRESETS[preset] },
    }));
  }, []);

  const setEffect = useCallback(
    (effect: keyof EffectSettings, value: boolean) => {
      setSettings((prev) => ({
        ...prev,
        effects: { ...prev.effects, [effect]: value },
      }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(structuredClone(DEFAULT_SETTINGS));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setKeybinding,
      applyPreset,
      setEffect,
      resetSettings,
    }),
    [settings, setKeybinding, applyPreset, setEffect, resetSettings]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
