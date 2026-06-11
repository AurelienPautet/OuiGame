// Client-side presentation layer for the shared achievements catalog
// (@ouigame/shared/api → ACHIEVEMENTS). The catalog supplies stable keys,
// categories and lucide icon NAMES; here we map those names to icon components
// and resolve localized name/description strings from i18n. Keeping this out of
// ToastContext avoids an import cycle (ToastContext + the API hooks both use it).
import i18n from "../i18n";
import {
  Swords,
  Flame,
  ShieldCheck,
  Feather,
  Target,
  Droplet,
  Crosshair,
  Crown,
  Trophy,
  Medal,
  Bomb,
  Hammer,
  Footprints,
  GraduationCap,
  Sparkles,
  Map as MapIcon,
  Mountain,
  Award,
  type LucideIcon,
} from "lucide-react";

// Catalog icon name → lucide component. Consumers do a record LOOKUP (never a
// function call returning a component, which the react-hooks rule rejects during
// render — same shape as TOAST_ICONS in Toast.tsx).
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  Swords,
  Flame,
  ShieldCheck,
  Feather,
  Target,
  Droplet,
  Crosshair,
  Crown,
  Trophy,
  Medal,
  Bomb,
  Hammer,
  Footprints,
  GraduationCap,
  Sparkles,
  Map: MapIcon,
  Mountain,
};

/** Fallback icon for any catalog key whose icon name isn't in the map above. */
export const ACHIEVEMENT_ICON_FALLBACK: LucideIcon = Award;

/** Localized achievement title for the given catalog key. */
export const achievementName = (key: string): string =>
  i18n.t(`achievements.items.${key}.name`);

/** Localized achievement description for the given catalog key. */
export const achievementDesc = (key: string): string =>
  i18n.t(`achievements.items.${key}.desc`);
