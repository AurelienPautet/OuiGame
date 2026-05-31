// i18n setup (react-i18next). English is the source of truth; fr/es/de/it are
// translated from it. The active language is detected from localStorage (set by
// the settings language picker) then the browser, and cached back to
// localStorage so it persists across sessions.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

/** The languages the UI ships with, in picker display order. */
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// localStorage key the detector reads/writes (kept distinct from the app's
// other storage keys; the settings picker drives it via i18n.changeLanguage).
export const LANGUAGE_STORAGE_KEY = "ouigame_lang";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      de: { translation: de },
      it: { translation: it },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    // Match only the base language (e.g. "fr-FR" → "fr").
    load: "languageOnly",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    interpolation: { escapeValue: false },
    // Keep t() returning string (never null) under strict TS.
    returnNull: false,
    // Resources are bundled and init is synchronous, so there's nothing to wait
    // on — skip Suspense (the app has no i18n Suspense boundary).
    react: { useSuspense: false },
  });

export default i18n;
