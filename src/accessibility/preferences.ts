export type AccessibilityPreferences = {
  textSize: 100 | 125 | 150 | 200;
  contrast: "original" | "light" | "dark";
  colorMode: "original" | "grayscale" | "low-saturation" | "high-saturation";
  readableFont: boolean;
  textSpacing: boolean;
  underlineLinks: boolean;
  largeCursor: boolean;
  reduceMotion: boolean;
  hideImages: boolean;
  readingGuide: boolean;
};

export const STORAGE_KEY = "kodu-accessibility-v1";

export const defaultPreferences: AccessibilityPreferences = {
  textSize: 100,
  contrast: "original",
  colorMode: "original",
  readableFont: false,
  textSpacing: false,
  underlineLinks: false,
  largeCursor: false,
  reduceMotion: false,
  hideImages: false,
  readingGuide: false,
};

export type TogglePreference = {
  [
    Key in keyof AccessibilityPreferences
  ]: AccessibilityPreferences[Key] extends boolean ? Key : never;
}[keyof AccessibilityPreferences];

const toggleKeys: TogglePreference[] = [
  "readableFont",
  "textSpacing",
  "underlineLinks",
  "largeCursor",
  "reduceMotion",
  "hideImages",
  "readingGuide",
];

export function validatePreferences(value: unknown): AccessibilityPreferences {
  const result = { ...defaultPreferences };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  const stored = value as Record<string, unknown>;
  if ([100, 125, 150, 200].includes(stored.textSize as number)) {
    result.textSize = stored.textSize as AccessibilityPreferences["textSize"];
  }
  if (["original", "light", "dark"].includes(stored.contrast as string)) {
    result.contrast = stored.contrast as AccessibilityPreferences["contrast"];
  }
  if (
    ["original", "grayscale", "low-saturation", "high-saturation"].includes(
      stored.colorMode as string,
    )
  ) {
    result.colorMode =
      stored.colorMode as AccessibilityPreferences["colorMode"];
  }
  for (const key of toggleKeys) {
    if (typeof stored[key] === "boolean") result[key] = stored[key];
  }
  return result;
}

export function readPreferences(): AccessibilityPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return validatePreferences(parsed);
        }
      } catch {
        // An unreadable preference must not prevent opening the website.
      }
    }
    if (localStorage.getItem("kodu-large-text") === "true") {
      return { ...defaultPreferences, textSize: 125 };
    }
  } catch {
    // Settings still work for the current visit if browser storage is unavailable.
  }
  return { ...defaultPreferences };
}

export function writePreferences(preferences: AccessibilityPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    localStorage.removeItem("kodu-large-text");
  } catch {
    // Browser storage is optional; the current settings remain applied.
  }
}

export function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(preferences)) {
    const attribute = key.replace(
      /[A-Z]/g,
      (letter) => `-${letter.toLowerCase()}`,
    );
    root.setAttribute(`data-a11y-${attribute}`, String(value));
  }
  root.classList.toggle("large-text", preferences.textSize > 100);
}
