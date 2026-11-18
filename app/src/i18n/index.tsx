import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { secure } from "@/lib/storage";
import { en, type Dict } from "./en";
import { es, SERVER_ERRORS_ES } from "./es";

export type Lang = "en" | "es";
const DICTS: Record<Lang, Dict> = { en, es };
const LANG_KEY = "still-growing.language";

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

// The current language is also kept in a module variable so non-React code
// (notifications, API errors) can read it.
let current: Lang = deviceLang();
export const currentLang = () => current;
export const dict = () => DICTS[current];

export function translateServerError(message: string): string {
  return current === "es" ? (SERVER_ERRORS_ES[message] ?? message) : message;
}

interface I18n {
  lang: Lang;
  s: Dict;
  /** BCP-47 tag for dates and times. */
  locale: string;
  setLang: (l: Lang) => void;
  /** Built-in category name by id, falling back to the stored (custom) name. */
  category: (id: string, fallback?: string) => string;
  suggestion: (name: string) => string;
  unit: (u: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);

  useEffect(() => {
    secure.get(LANG_KEY).then((saved) => {
      if (saved === "en" || saved === "es") {
        current = saved;
        setLangState(saved);
      }
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
    void secure.set(LANG_KEY, l);
  }, []);

  const value = useMemo<I18n>(() => {
    const s = DICTS[lang];
    return {
      lang,
      s,
      locale: lang === "es" ? "es" : "en-US",
      setLang,
      category: (id, fallback) => s.categories[id] ?? fallback ?? id,
      suggestion: (name) => s.suggestions[name] ?? name,
      unit: (u) => s.units[u] ?? u,
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
