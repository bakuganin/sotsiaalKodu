import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "./fixtures";
import {
  accessibilityDialog,
  closeAccessibility,
  openAccessibility,
} from "./accessibility-helpers";

const storageKey = "kodu-accessibility-v1";
const defaults = {
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
const toggleNames = [
  "Простой шрифт",
  "Больше интервалов",
  "Подчёркивать ссылки",
  "Крупный курсор",
  "Меньше движения",
  "Скрыть декоративные изображения",
  "Линия для чтения",
];

async function waitForSiteReady(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
}

async function expectFitsViewport(page: Page, element?: Locator) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  if (!element) return;
  const bounds = await element.evaluate((node) => ({
    left: node.getBoundingClientRect().left,
    right: node.getBoundingClientRect().right,
    contentWidth: node.scrollWidth,
    width: node.clientWidth,
  }));
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width + 1);
}

async function expectFocusWithin(page: Page, dialog: Locator) {
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate(
        (node) => node.contains(document.activeElement) || !document.hasFocus(),
      ),
    ).toBe(true);
  }
}

test("round launcher opens a keyboard modal and supports returning to an active booking", async ({
  page,
}) => {
  await page.goto("/");
  await waitForSiteReady(page);
  const launcher = page.getByRole("button", {
    name: "Настройки доступности",
    exact: true,
  });
  const geometry = await launcher.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const styles = getComputedStyle(node);
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      bottom: window.innerHeight - rect.bottom,
      radius: styles.borderRadius,
      position: styles.position,
    };
  });
  expect(geometry.position).toBe("fixed");
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(1);
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.left).toBeLessThan(40);
  expect(geometry.bottom).toBeLessThan(40);
  expect(parseFloat(geometry.radius)).toBeGreaterThanOrEqual(
    geometry.width / 2,
  );
  await launcher.focus();
  await page.keyboard.press("Enter");
  const dialog = accessibilityDialog(page);
  await expect(dialog).toBeVisible();
  await expectFocusWithin(page, dialog);
  await closeAccessibility(page);
  await expect(launcher).toBeFocused();

  const bookingTrigger = page.locator(".hero-actions button");
  await bookingTrigger.click();
  const booking = page.locator("dialog.booking-dialog");
  await expect(booking).toBeVisible();
  await expectFocusWithin(page, booking);
  await expect(dialog).not.toBeVisible();
  await booking.getByText("Помощь на дому", { exact: true }).click();
  await expect(
    booking.getByRole("radio", { name: "Помощь на дому", exact: true }),
  ).toBeChecked();
  await openAccessibility(page);
  await expectFocusWithin(page, dialog);
  await closeAccessibility(page);
  await expect(booking).toBeVisible();
  await expect(
    booking.getByRole("radio", { name: "Помощь на дому", exact: true }),
  ).toBeChecked();
  await expect(launcher).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(booking).not.toBeVisible();
  await expect(bookingTrigger).toBeFocused();
  await openAccessibility(page);
  await closeAccessibility(page);
});

test("all preferences persist after reload and reset restores the original appearance", async ({
  page,
}) => {
  await page.goto("/");
  await waitForSiteReady(page);
  const originalFont = await page
    .locator("html")
    .evaluate((node) => getComputedStyle(node).fontSize);
  let dialog = await openAccessibility(page);
  await dialog.getByRole("radio", { name: "150%", exact: true }).check();
  await dialog.getByRole("radio", { name: "Тёмный", exact: true }).check();
  await dialog.getByRole("radio", { name: "Без цвета", exact: true }).check();
  for (const name of toggleNames)
    await dialog.getByRole("checkbox", { name, exact: true }).check();
  const selected = {
    ...defaults,
    textSize: 150,
    contrast: "dark",
    colorMode: "grayscale",
    readableFont: true,
    textSpacing: true,
    underlineLinks: true,
    largeCursor: true,
    reduceMotion: true,
    hideImages: true,
    readingGuide: true,
  };
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        storageKey,
      ),
    )
    .toEqual(selected);
  await closeAccessibility(page);
  await expect(page.locator("main")).toHaveCSS("filter", "grayscale(1)");
  const paragraph = page.locator(".hero-support > p:not(.eyebrow)");
  await expect(paragraph).toHaveCSS("font-family", /Arial/);
  expect(
    await paragraph.evaluate((node) =>
      parseFloat(getComputedStyle(node).wordSpacing),
    ),
  ).toBeGreaterThan(0);
  await expect(page.locator(".hero-support > a")).toHaveCSS(
    "text-decoration-line",
    "underline",
  );
  await expect(paragraph).toHaveCSS("cursor", /url\(/);
  await expect(page.locator(".hero-image img")).not.toBeVisible();
  await page.goto("/team/");
  await expect(page.locator(".team-photo").first()).toBeVisible();
  await page.goto("/");
  const guide = page.locator(".a11y-reading-guide");
  await expect(guide).toBeVisible();
  await expect(guide).toHaveCSS("pointer-events", "none");
  await page.mouse.move(150, 220);
  await expect(guide).toHaveCSS("top", "220px");
  await page.reload();
  await waitForSiteReady(page);
  dialog = await openAccessibility(page);
  for (const name of ["150%", "Тёмный", "Без цвета"])
    await expect(
      dialog.getByRole("radio", { name, exact: true }),
    ).toBeChecked();
  for (const name of toggleNames)
    await expect(
      dialog.getByRole("checkbox", { name, exact: true }),
    ).toBeChecked();
  await dialog.getByRole("button", { name: "Сбросить настройки" }).click();
  for (const name of ["100%", "Обычный", "Оригинальные"])
    await expect(
      dialog.getByRole("radio", { name, exact: true }),
    ).toBeChecked();
  for (const name of toggleNames)
    await expect(
      dialog.getByRole("checkbox", { name, exact: true }),
    ).not.toBeChecked();
  await closeAccessibility(page);
  await expect(page.locator("main")).toHaveCSS("filter", "none");
  await expect(page.locator(".hero-image img")).toBeVisible();
  await expect(page.locator(".a11y-reading-guide")).not.toBeVisible();
  await expect
    .poll(() =>
      page.locator("html").evaluate((node) => getComputedStyle(node).fontSize),
    )
    .toBe(originalFont);
  await page.reload();
  await waitForSiteReady(page);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    ),
  ).toEqual(defaults);
});

test("stored settings are validated and the legacy text preference migrates once", async ({
  page,
}) => {
  await page.goto("/");
  await waitForSiteReady(page);
  await page.evaluate((key) => {
    localStorage.removeItem(key);
    localStorage.setItem("kodu-large-text", "true");
  }, storageKey);
  await page.reload();
  await waitForSiteReady(page);
  let dialog = await openAccessibility(page);
  await expect(dialog.getByRole("radio", { name: "125%" })).toBeChecked();
  await dialog.getByRole("button", { name: "Сбросить настройки" }).click();
  await page.reload();
  await waitForSiteReady(page);
  dialog = await openAccessibility(page);
  await expect(dialog.getByRole("radio", { name: "100%" })).toBeChecked();

  for (const invalid of [
    "{invalid JSON",
    JSON.stringify({
      textSize: "200",
      contrast: "invalid",
      colorMode: "sepia",
      readableFont: true,
      textSpacing: "true",
      reduceMotion: [],
      unwanted: "ignore",
    }),
  ]) {
    await page.evaluate(
      ({ key, value }) => {
        localStorage.removeItem("kodu-large-text");
        localStorage.setItem(key, value);
      },
      { key: storageKey, value: invalid },
    );
    await page.reload();
    await waitForSiteReady(page);
    dialog = await openAccessibility(page);
    for (const name of ["100%", "Обычный", "Оригинальные"])
      await expect(
        dialog.getByRole("radio", { name, exact: true }),
      ).toBeChecked();
    await expect(
      dialog.getByRole("checkbox", { name: "Больше интервалов", exact: true }),
    ).not.toBeChecked();
    await expect(
      dialog.getByRole("checkbox", { name: "Меньше движения", exact: true }),
    ).not.toBeChecked();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        storageKey,
      ),
    ).toEqual({ ...defaults, readableFont: invalid.startsWith('{"') });
  }
});

test("320px supports every control and booking at 200% text with extra spacing", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(new Date("2026-09-14T00:30:00Z"));
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await waitForSiteReady(page);
  const originalFont = await page
    .locator(".hero-support > p:not(.eyebrow)")
    .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  const dialog = await openAccessibility(page);
  for (const radio of await dialog.getByRole("radio").all()) {
    await radio.check();
    await expect(radio).toBeChecked();
  }
  for (const name of toggleNames) {
    const toggle = dialog.getByRole("checkbox", { name, exact: true });
    await toggle.check();
    await expect(toggle).toBeChecked();
  }
  await expectFitsViewport(page, dialog);
  await dialog.getByRole("button", { name: "Сбросить настройки" }).click();
  await dialog.getByRole("radio", { name: "200%", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "Больше интервалов" }).check();
  await dialog.getByRole("checkbox", { name: "Простой шрифт" }).check();
  await expectFitsViewport(page, dialog);
  await closeAccessibility(page);
  await expectFitsViewport(page);
  const enlargedFont = await page
    .locator(".hero-support > p:not(.eyebrow)")
    .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
  expect(enlargedFont / originalFont).toBeGreaterThanOrEqual(1.9);

  await page.locator(".hero-actions button").click();
  const booking = page.locator("dialog.booking-dialog");
  await expectFitsViewport(page, booking);
  await booking.getByText("Помощь на дому", { exact: true }).click();
  await expect(
    booking.getByRole("radio", { name: "Помощь на дому", exact: true }),
  ).toBeChecked();
  await booking.getByRole("button", { name: "Продолжить" }).click();
  await expectFitsViewport(page, booking);
  await booking.getByRole("button", { name: /15 сентября 2026/ }).click();
  await booking.getByText("09:30", { exact: true }).click();
  await expect(
    booking.getByRole("radio", { name: "09:30 — пример времени", exact: true }),
  ).toBeChecked();
  await booking.getByRole("button", { name: "Продолжить" }).click();
  await expectFitsViewport(page, booking);
  await booking.getByLabel("Ваше имя", { exact: true }).fill("Анна Тестовая");
  await booking
    .getByLabel("Номер телефона", { exact: true })
    .fill("+372 5555 0000");
  await booking.getByRole("button", { name: "Проверить запись" }).click();
  await expect(booking.getByRole("status")).toContainText(
    "Заявка не отправлена",
  );
  await expectFitsViewport(page, booking);
  await booking.getByRole("button", { name: "Закрыть предпросмотр" }).click();
  await openAccessibility(page);
  await dialog.getByRole("button", { name: "Сбросить настройки" }).click();
  await closeAccessibility(page);
  await expectFitsViewport(page);
});

test("the motion preference stops team transitions even without an OS motion preference", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/team/");
    await waitForSiteReady(page);
    const dialog = await openAccessibility(page);
    await dialog.getByRole("checkbox", { name: "Меньше движения" }).check();
    await closeAccessibility(page);
    const section = page.locator(".people-team");
    await section.scrollIntoViewIfNeeded();
    const running = await section.evaluate(async (node) => {
      node
        .querySelector<HTMLButtonElement>(".team-eduard .team-portrait")!
        .click();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      return node
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length;
    });
    expect(running).toBe(0);
    await expect(
      section.getByRole("button", { name: "Эдуард Ист", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#team-panel-eduard")).toBeVisible();
  }
});

test("the settings panel passes automated checks in each contrast mode", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await waitForSiteReady(page);
  const dialog = await openAccessibility(page);
  for (const name of ["Обычный", "Светлый", "Тёмный"]) {
    await dialog.getByRole("radio", { name, exact: true }).check();
    const results = await new AxeBuilder({ page })
      .include("dialog[open]")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations)).toEqual([]);
  }
});
