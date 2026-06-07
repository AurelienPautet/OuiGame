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
  type TouchControlsMode,
} from "../lib/settings";
import { applyKeyBindings } from "../engine/InputHandler";
import { setAudioEnabled } from "../audio";

interface SettingsContextValue {
  settings: Settings;
  setKeybinding: (action: GameAction, code: string) => void;
  applyPreset: (preset: PresetName) => void;
  setEffect: (effect: keyof EffectSettings, value: boolean) => void;
  setTouchControls: (mode: TouchControlsMode) => void;
  setAutoFire: (value: boolean) => void;
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
    // Mute/unmute the shared audio bus so UI sounds honour the setting even
    // when no game engine is mounted (the engine also applies it in-game).
    setAudioEnabled(settings.effects.sound);
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

  const setTouchControls = useCallback((mode: TouchControlsMode) => {
    setSettings((prev) => ({ ...prev, touchControls: mode }));
  }, []);

  const setAutoFire = useCallback((value: boolean) => {
    setSettings((prev) => ({ ...prev, autoFire: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(structuredClone(DEFAULT_SETTINGS));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setKeybinding,
      applyPreset,
      setEffect,
      setTouchControls,
      setAutoFire,
      resetSettings,
    }),
    [
      settings,
      setKeybinding,
      applyPreset,
      setEffect,
      setTouchControls,
      setAutoFire,
      resetSettings,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
