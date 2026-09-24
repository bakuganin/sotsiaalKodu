import { ru } from "./ru";

// Add approved translation dictionaries here. Untranslated locales are never advertised as available.
export const locales = { ru };
export type Locale = keyof typeof locales;
export const defaultLocale: Locale = "ru";
export function getContent(locale: Locale = defaultLocale) {
  return locales[locale];
}

// Keep company facts separate from translations and presentation for a future CMS adapter.
export const organization = {
  publicName: "Sotsiaal Kodu",
  name: "Sotsiaalsete Teenuste Kodu OÜ",
  registryCode: "17591732",
  phone: "+37253049699",
  phoneDisplay: "+372 5304 9699",
  email: "natalia.umarova@gmail.com",
  legalAddress: "Tuleviku tn 7, 20307 Narva, Ida-Virumaa, Эстония",
  registeredAddress: "Ida-Viru maakond, Narva linn, Tuleviku tn 7, 20307",
  legalForm: "Osaühing (OÜ) — общество с ограниченной ответственностью",
  registrationDate: "04.09.2026",
  shareCapital: "2 500 €",
  financialYear: "01.01–31.12",
  board: ["Natalia Umarova", "Eduard East"],
  registryCheckedAt: "24.09.2026",
  registryUrl:
    "https://ariregister.rik.ee/est/company/17591732/Sotsiaalsete-Teenuste-Kodu-O%C3%9C",
  // The registry address is not a confirmed appointment location.
  appointmentAddress: null,
  bookingMode: "demo",
} as const;
