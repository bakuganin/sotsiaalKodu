import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Locator } from "./fixtures";

test.use({ siteLocale: "default" });

const switcher = (page: Page) =>
  page.locator(".sk-header-actions .language-switcher");
async function choose(page: Page, name: string, root = switcher(page)) {
  await root.locator(".language-trigger").click();
  await root.getByRole("menuitemradio", { name, exact: true }).click();
}
async function frames(trigger: Locator, selector: string) {
  return trigger.evaluate(async (element, target) => {
    const values: number[] = [];
    (element as HTMLElement).click();
    const start = performance.now();
    while (performance.now() - start < 480) {
      await new Promise(requestAnimationFrame);
      values.push(
        Number(getComputedStyle(document.querySelector(target)!).opacity),
      );
    }
    return values;
  }, selector);
}

test("Estonian is the default and switching translates the current page without a reload", async ({
  page,
  context,
}) => {
  await page.goto("/contact/#contact-meeting");
  await expect(page.locator("html")).toHaveAttribute("lang", "et");
  await expect(page).toHaveTitle("Kontakt — Sotsiaal Kodu");
  await expect(page.locator("h1")).toHaveText("Oleme teie jaoks olemas");
  await page.evaluate(
    () => (document.body.dataset.documentMarker = "unchanged"),
  );
  const secondTab = await context.newPage();
  await secondTab.goto("http://127.0.0.1:5173/team/");
  const trigger = switcher(page).locator(".language-trigger");
  await trigger.click();
  await expect(switcher(page).getByRole("menuitemradio")).toHaveText([
    "ETEesti",
    "RUРусский",
    "ENEnglish",
  ]);
  await switcher(page)
    .getByRole("menuitemradio", { name: "Русский", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("h1")).toHaveText("Мы на связи");
  await expect(secondTab.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page).toHaveURL(/\/contact\/#contact-meeting$/);
  await expect(page.locator("body")).toHaveAttribute(
    "data-document-marker",
    "unchanged",
  );
  await choose(page, "English");
  await expect(page.locator("h1")).toHaveText("We are here for you");
  await expect(page).toHaveTitle("Contact — Sotsiaal Kodu");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .locator("#main-navigation")
    .getByRole("link", { name: "Our team", exact: true })
    .click();
  await expect(page).toHaveURL(/\/team\/$/);
  await expect(page.locator("h1")).toHaveText(
    "People who care about your wellbeing",
  );
  await choose(page, "Eesti");
  await expect(page.locator("html")).toHaveAttribute("lang", "et");
  expect(
    await page.evaluate(() => localStorage.getItem("sotsiaal-language")),
  ).toBe("et");
});

test("language menu supports keyboard selection, Escape and outside clicks", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = switcher(page).locator(".language-trigger");
  const menu = switcher(page).getByRole("menu");
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    switcher(page).getByRole("menuitemradio", { name: "Eesti", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    switcher(page).getByRole("menuitemradio", { name: "English", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator("h1").click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.keyboard.press("Tab");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("menu and content transitions render smoothly and respect reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/contact/");
  const trigger = switcher(page).locator(".language-trigger");
  const selector = ".sk-header-actions .language-menu";
  const opening = await frames(trigger, selector);
  expect(opening.some((value) => value > 0.02 && value < 0.98)).toBe(true);
  const changing = await frames(
    switcher(page).getByRole("menuitemradio", { name: "English", exact: true }),
    "main",
  );
  expect(changing.some((value) => value < 0.95)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await trigger.click();
  await expect(page.locator(selector)).toHaveCSS("opacity", "1");
  const closing = await frames(trigger, selector);
  expect(closing.some((value) => value > 0.02 && value < 0.98)).toBe(true);
  for (const mode of ["system", "site"]) {
    await page.emulateMedia({
      reducedMotion: mode === "system" ? "reduce" : "no-preference",
    });
    if (mode === "site")
      await page.evaluate(
        () => (document.documentElement.dataset.a11yReduceMotion = "true"),
      );
    const immediate = await frames(trigger, selector);
    expect(immediate.every((value) => value === 1)).toBe(true);
    await switcher(page)
      .getByRole("menuitemradio", {
        name: mode === "system" ? "Eesti" : "English",
        exact: true,
      })
      .click();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-language-transition",
    );
    await expect(page.locator("main")).toHaveCSS("opacity", "1");
  }
});

for (const locale of ["et", "en"] as const) {
  test(`all ${locale} pages, booking and accessibility are translated on mobile`, async ({
    page,
  }) => {
    await page.addInitScript(
      (lang) => localStorage.setItem("sotsiaal-language", lang),
      locale,
    );
    await page.setViewportSize({ width: 320, height: 844 });
    for (const route of [
      "/",
      "/services/",
      "/team/",
      "/contact/",
      "/company/",
      "/privacy/",
      "/cookies/",
      "/terms/",
    ]) {
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      expect(await page.locator("main").innerText()).not.toMatch(/[А-Яа-яЁё]/);
      expect(await page.locator(".site-footer").innerText()).not.toMatch(
        /[А-Яа-яЁё]/,
      );
      expect(await page.title()).not.toMatch(/[А-Яа-яЁё]/);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    await page.locator(".a11y-launcher").click();
    expect(await page.locator("dialog.a11y-dialog").innerText()).not.toMatch(
      /[А-Яа-яЁё]/,
    );
    await page.getByRole("radio", { name: "200%", exact: true }).check();
    await page.keyboard.press("Escape");
    await switcher(page).locator(".language-trigger").click();
    expect(
      await switcher(page)
        .getByRole("menu")
        .evaluate((e) => e.scrollWidth - e.clientWidth),
    ).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await page.locator(".a11y-launcher").click();
    await page.getByRole("radio", { name: "100%", exact: true }).check();
    await page.keyboard.press("Escape");
    await page.locator(".sk-menu-toggle").click();
    const mobile = page.locator("#mobile-navigation");
    const picker = mobile.locator(".language-switcher");
    await picker.locator(".language-trigger").click();
    await page.keyboard.press("Escape");
    await expect(mobile).toBeVisible();
    await mobile.locator(".sk-mobile-book").click();
    const booking = page.locator("dialog.booking-dialog");
    await expect(booking).toBeVisible();
    expect(await booking.innerText()).not.toMatch(/[А-Яа-яЁё]/);
    await booking.getByRole("radio").first().check();
    await booking
      .getByRole("button", {
        name: locale === "et" ? "Jätka" : "Continue",
        exact: true,
      })
      .click();
    expect(await booking.innerText()).not.toMatch(/[А-Яа-яЁё]/);
    await expect(booking.locator(".booking-weekday").first()).toContainText(
      locale === "et" ? "E" : "Mon",
    );
    await page.keyboard.press("Escape");
    await page.goto("/contact/");
    await switcher(page).locator(".language-trigger").click();
    const audit = await new AxeBuilder({ page })
      .include(".language-switcher")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
  });
}

test("language still switches when browser storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "et");
  await choose(page, "Русский");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await page
    .locator("#main-navigation")
    .getByRole("link", { name: "Контакты", exact: true })
    .click();
  await expect(page.locator("h1")).toHaveText("Мы на связи");
});

test.describe("first visit", () => {
  test.use({ developmentNotice: "first-visit" });
  test("the introductory notice also offers all three languages", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/");
    const notice = page.locator("dialog.development-notice");
    await expect(notice).toHaveAccessibleName("Veebileht on arendamisel");
    await choose(page, "Русский", notice.locator(".language-switcher"));
    await expect(notice).toHaveAccessibleName("Сайт ещё в разработке");
    await notice
      .getByRole("button", { name: "Перейти на сайт", exact: true })
      .click();
    await expect(notice).not.toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });
});
