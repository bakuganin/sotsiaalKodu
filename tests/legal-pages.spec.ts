import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";
import { setTextSize } from "./accessibility-helpers";

const pages = [
  ["company", "Информация о компании"],
  ["privacy", "Политика конфиденциальности"],
  ["cookies", "Cookies и данные браузера"],
  ["terms", "Условия использования"],
] as const;

for (const [path, title] of pages) {
  test(`${path} supports direct visits, reload, mobile and enlarged text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/${path}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page).toHaveTitle(`${title} — Sotsiaal Kodu`);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(
      page
        .getByRole("navigation", { name: "Информация и документы" })
        .getByRole("link", { name: title, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    await setTextSize(page, "200%");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const audit = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
  });
}

test("footer documents navigate as pages and old privacy bookmarks still work", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Правовая информация" });
  for (const [path, title] of pages) {
    await footer.getByRole("link", { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${path}/$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/cookies\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/terms\/$/);
  await page.goto("/team/#/privacy");
  await expect(page).toHaveURL(/\/privacy\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Политика конфиденциальности",
  );
  await page.goto("/cookies/");
  await page.locator('main a[href="/privacy/#privacy-providers"]').click();
  await expect(page).toHaveURL(/\/privacy\/#privacy-providers$/);
  await expect(page.locator("#privacy-providers")).toBeInViewport();
});

test("company details match the extract without exposing personal identification codes", async ({
  page,
}) => {
  await page.goto("/company/");
  const content = page.locator(".legal-content");
  for (const value of [
    "Sotsiaalsete Teenuste Kodu OÜ",
    "17591732",
    "04.09.2026",
    "Tuleviku tn 7",
    "2 500 €",
    "Natalia Umarova",
    "Eduard East",
    "natalia.umarova@gmail.com",
  ]) {
    await expect(content).toContainText(value);
  }
  expect(await content.textContent()).not.toMatch(/\b\d{11}\b/);
  await expect(
    content.getByRole("link", { name: /эстонским бизнес-регистром/ }),
  ).toHaveAttribute("href", /ariregister\.rik\.ee.*17591732/);
  await expect(content).toContainText("не означает, что по нему ведётся приём");
});

test("browser storage disclosure matches the app and does not add tracking", async ({
  page,
  context,
}) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).hostname));
  await page.goto("/cookies/");
  await expect(page.locator(".legal-content")).toContainText(
    "kodu-accessibility-v1",
  );
  await expect(page.locator(".legal-content")).toContainText(
    "sotsiaal-development-notice-dismissed",
  );
  expect(await context.cookies()).toEqual([]);
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storage.local).toEqual(["kodu-accessibility-v1"]);
  expect(storage.session).toEqual(["sotsiaal-development-notice-dismissed"]);
  expect([...hosts]).toEqual(["127.0.0.1"]);
});

test("booking privacy opens separately and preserves the demo fields", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-09-24T10:00:00Z"));
  await page.goto("/");
  await page.locator(".hero-actions .pill-button").click();
  const dialog = page.locator("dialog.booking-dialog");
  await dialog.getByRole("radio").first().check();
  await dialog.getByRole("button", { name: "Продолжить" }).click();
  await dialog.locator(".booking-day:not([disabled])").first().click();
  await dialog.locator(".booking-time-value").first().click();
  await dialog.getByRole("button", { name: "Продолжить" }).click();
  await dialog.getByLabel("Ваше имя").fill("Анна");
  const popupPromise = page.waitForEvent("popup");
  await dialog
    .getByRole("link", { name: /Политика конфиденциальности/ })
    .click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/privacy\/$/);
  await expect(popup.getByRole("heading", { level: 1 })).toHaveText(
    "Политика конфиденциальности",
  );
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Ваше имя")).toHaveValue("Анна");
  await popup.close();
});
