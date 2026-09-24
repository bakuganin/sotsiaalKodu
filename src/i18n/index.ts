import { useSyncExternalStore } from "react";
import messages from "./messages.json";

export const languages = [
  { code: "et", name: "Eesti", intl: "et-EE" },
  { code: "ru", name: "Русский", intl: "ru-RU" },
  { code: "en", name: "English", intl: "en-GB" },
] as const;
export type Locale = (typeof languages)[number]["code"];
export const LANGUAGE_KEY = "sotsiaal-language";
export const defaultLocale: Locale = "et";
const isLocale = (value: unknown): value is Locale =>
  languages.some(({ code }) => code === value);

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return isLocale(saved) ? saved : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

let currentLocale = readLocale();
const listeners = new Set<() => void>();
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
export const getLocale = () => currentLocale;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useLocale = () =>
  useSyncExternalStore(subscribe, getLocale, () => defaultLocale);
export const getIntlLocale = () =>
  languages.find(({ code }) => code === currentLocale)!.intl;

function commitLocale(locale: Locale) {
  currentLocale = locale;
  document.documentElement.lang = locale;
  listeners.forEach((listener) => listener());
}

export function setLocale(locale: Locale) {
  if (!isLocale(locale)) return;
  clearTimeout(transitionTimer);
  const root = document.documentElement;
  delete root.dataset.languageTransition;
  if (locale === currentLocale) return;
  const commit = () => {
    try {
      localStorage.setItem(LANGUAGE_KEY, locale);
    } catch {
      /* Keep the in-memory choice when storage is unavailable. */
    }
    commitLocale(locale);
    delete root.dataset.languageTransition;
  };
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    root.dataset.a11yReduceMotion === "true"
  )
    commit();
  else {
    root.dataset.languageTransition = "out";
    transitionTimer = setTimeout(commit, 140);
  }
}

window.addEventListener("storage", (event) => {
  if (event.key !== LANGUAGE_KEY && event.key !== null) return;
  clearTimeout(transitionTimer);
  delete document.documentElement.dataset.languageTransition;
  commitLocale(isLocale(event.newValue) ? event.newValue : defaultLocale);
});

const dictionary: Record<string, readonly string[]> = messages;
const normalized = Object.fromEntries(
  Object.entries(dictionary).map(([key, value]) => [
    key.replace(/\s+/g, " ").trim(),
    value,
  ]),
);

/** Source phrases are stable message keys; identifiers and company facts stay intact. */
export function tr(text: string, locale: Locale = currentLocale): string {
  if (locale === "ru") return text;
  const direct = dictionary[text];
  if (direct) return direct[locale === "et" ? 0 : 1];
  const value = normalized[text.replace(/\s+/g, " ").trim()];
  if (!value) return text;
  return (
    (text.match(/^\s*/)?.[0] ?? "") +
    value[locale === "et" ? 0 : 1] +
    (text.match(/\s*$/)?.[0] ?? "")
  );
}

export type Localized<T> = T extends string
  ? string
  : T extends readonly unknown[]
    ? { [K in keyof T]: Localized<T[K]> }
    : T extends object
      ? {
          [K in keyof T]: K extends "id" | "icon" | "theme" | "key" | "value"
            ? T[K]
            : Localized<T[K]>;
        }
      : T;

export function localize<T>(
  value: T,
  locale: Locale = currentLocale,
): Localized<T> {
  if (typeof value === "string") return tr(value, locale) as Localized<T>;
  if (Array.isArray(value))
    return value.map((item) => localize(item, locale)) as Localized<T>;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, localize(item, locale)]),
    ) as Localized<T>;
  return value as Localized<T>;
}
