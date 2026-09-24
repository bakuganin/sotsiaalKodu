import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import { setTextSize } from "./accessibility-helpers";

test("contact page survives direct visits and reload, with real communication links and address context", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/contact/");
  await expect(page).toHaveTitle("Контакты — Sotsiaal Kodu");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Мы на связи",
  );
  const cards = page.getByRole("list", { name: "Контакты и полезные ссылки" });
  await expect(
    cards.getByRole("link", { name: "Позвонить нам" }),
  ).toHaveAttribute("href", "tel:+37253049699");
  await expect(
    cards.getByRole("link", { name: "Написать нам" }),
  ).toHaveAttribute("href", "mailto:natalia.umarova@gmail.com");
  const details = page.locator("#contact-details");
  await expect(details.locator('a[href="tel:+37253049699"]')).toContainText(
    "+372 5304 9699",
  );
  await expect(
    details.locator('a[href="mailto:natalia.umarova@gmail.com"]'),
  ).toContainText("natalia.umarova@gmail.com");
  await expect(details).toContainText("Sotsiaalsete Teenuste Kodu OÜ");
  await expect(details).toContainText("17591732");
  await cards.getByRole("link", { name: "Как встретиться" }).click();
  await expect(page).toHaveURL(/\/contact\/#contact-meeting$/);
  await expect(page.locator("#contact-meeting")).toBeInViewport();
  await expect(page.locator("#contact-meeting")).toContainText(
    "Место и время приёма согласуются заранее",
  );
  await page.goto("/contact/#contact-address");
  await expect(page.locator("#contact-address")).toBeInViewport();
  await expect(page.locator("#contact-address")).toContainText(
    "Это адрес регистрации компании",
  );
  await expect(page.locator("#contact-address address")).toContainText(
    "Tuleviku tn 7, 20307 Narva",
  );
  await details.getByRole("link", { name: "Реквизиты компании" }).click();
  await expect(page).toHaveURL(/\/company\/$/);
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`contact navigation, history and active state work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const mobile = width < 760;
    if (mobile)
      await page
        .getByRole("button", { name: "Открыть меню", exact: true })
        .click();
    const navigation = page.locator(
      mobile ? "#mobile-navigation" : "#main-navigation",
    );
    await navigation
      .getByRole("link", { name: "Контакты", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact\/$/);
    await expect(page.locator("main")).toBeFocused();
    if (mobile)
      await page
        .getByRole("button", { name: "Открыть меню", exact: true })
        .click();
    await expect(
      navigation.getByRole("link", { name: "Контакты", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    if (mobile) await page.keyboard.press("Escape");
    await page.goBack();
    await expect(page).toHaveURL("http://127.0.0.1:5173/");
    await page
      .getByRole("navigation", { name: "Навигация в подвале" })
      .getByRole("link", { name: "Контакты", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  });
}

test("contact content and glass links remain readable at 320px and with 200% text", async ({
  page,
}) => {
  await page.goto("/contact/");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
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
  const cards = page.locator(".support-world-card-surface");
  for (const card of await cards.all()) {
    expect(
      await card.evaluate(
        (e) =>
          e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
      ),
    ).toBe(true);
  }
  const audit = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
});

test("contact links float independently, pause for keyboard focus and respect reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/contact/");
  const scene = page.locator(".support-world-scene");
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-floating", "true");
  const links = scene.getByRole("link");
  for (const link of await links.all())
    await expect(link).toHaveCSS("animation-play-state", "running");
  const first = links.first();
  const before = await first.evaluate((e) => getComputedStyle(e).transform);
  await expect
    .poll(() => first.evaluate((e) => getComputedStyle(e).transform))
    .not.toBe(before);
  await page.keyboard.press("Tab");
  await first.focus();
  await expect(first).toBeFocused();
  await expect(first).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const link of await links.all())
    await expect(link).toHaveCSS("animation-name", "none");
});
