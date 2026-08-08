import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { translations, Idioma } from "./translations";

// ============================================================
// CONTEXTO DE IDIOMA
// ------------------------------------------------------------
// - Arranca en "es" (evita mismatch de hidratación en SSR).
// - Al montar en el navegador: si ya eligió idioma antes (localStorage),
//   usa ese. Si no, autodetecta por el idioma del navegador
//   (navigator.language empieza con "en" -> inglés, cualquier otro -> es).
// - El selector manual (LanguageSwitcher) llama a setIdioma(), que persiste
//   la elección en localStorage para las próximas visitas.
// ============================================================

const STORAGE_KEY = "trulink_idioma";

type I18nContextType = {
  idioma: Idioma;
  setIdioma: (i: Idioma) => void;
  t: (path: string) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

function getValorAnidado(obj: any, path: string): string | undefined {
  return path.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>("es");

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY) as Idioma | null;
      if (guardado === "es" || guardado === "en") {
        setIdiomaState(guardado);
        return;
      }
      const navLang = navigator.language || "es";
      setIdiomaState(navLang.toLowerCase().startsWith("en") ? "en" : "es");
    } catch {
      // localStorage no disponible (SSR / navegación privada estricta) -> queda "es"
    }
  }, []);

  const setIdioma = (i: Idioma) => {
    setIdiomaState(i);
    try {
      localStorage.setItem(STORAGE_KEY, i);
    } catch {
      /* no-op */
    }
  };

  const t = (path: string): string => {
    const valor = getValorAnidado(translations[idioma], path);
    if (valor === undefined) {
      console.warn(`[i18n] Falta la clave "${path}" en el idioma "${idioma}"`);
      return path;
    }
    return valor;
  };

  return (
    <I18nContext.Provider value={{ idioma, setIdioma, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n() debe usarse dentro de <I18nProvider> (revisá pages/_app.tsx)");
  }
  return ctx;
}
