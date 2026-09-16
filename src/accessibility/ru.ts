import type { TogglePreference } from "./preferences";

export const accessibilityCopy = {
  title: "Настройки доступности",
  description: "Настройте сайт так, как вам удобнее читать и пользоваться им.",
  close: "Закрыть настройки доступности",
  reset: "Сбросить настройки",
  saved: "Настройки сохраняются в этом браузере.",
  textSize: {
    title: "Размер текста",
    options: [
      { value: 100, label: "100%" },
      { value: 125, label: "125%" },
      { value: 150, label: "150%" },
      { value: 200, label: "200%" },
    ],
  },
  contrast: {
    title: "Контраст",
    options: [
      { value: "original", label: "Обычный" },
      { value: "light", label: "Светлый" },
      { value: "dark", label: "Тёмный" },
    ],
  },
  colorMode: {
    title: "Цветовой режим",
    description:
      "Выберите отображение, при котором вам легче различать детали.",
    options: [
      { value: "original", label: "Оригинальные" },
      { value: "grayscale", label: "Без цвета" },
      { value: "low-saturation", label: "Мягкие" },
      { value: "high-saturation", label: "Насыщенные" },
    ],
  },
  togglesTitle: "Чтение и управление",
  toggles: [
    {
      key: "readableFont",
      label: "Простой шрифт",
      description: "Один привычный шрифт для всего текста.",
    },
    {
      key: "textSpacing",
      label: "Больше интервалов",
      description: "Больше места между строками, словами и буквами.",
    },
    {
      key: "underlineLinks",
      label: "Подчёркивать ссылки",
      description: "Помогает отличать ссылки от обычного текста.",
    },
    {
      key: "largeCursor",
      label: "Крупный курсор",
      description: "Увеличенный указатель мыши с контрастной обводкой.",
    },
    {
      key: "reduceMotion",
      label: "Меньше движения",
      description: "Отключить плавную прокрутку и переходы.",
    },
    {
      key: "hideImages",
      label: "Скрыть декоративные изображения",
      description:
        "Убрать украшения, сохранив фотографии команды и содержание.",
    },
    {
      key: "readingGuide",
      label: "Линия для чтения",
      description:
        "Следует за курсором. Стрелки ↑ и ↓ перемещают линию вне полей и кнопок.",
    },
  ] satisfies { key: TogglePreference; label: string; description: string }[],
} as const;
