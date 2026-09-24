import { expect, test, type Locator, type Page } from "./fixtures";
import {
  closeAccessibility,
  openAccessibility,
  setTextSize,
} from "./accessibility-helpers";

const desktopNavigation = (page: Page) => page.locator("#main-navigation");
const mobileMenu = (page: Page) =>
  page.getByRole("dialog", { name: "Основная навигация", exact: true });
const menuToggle = (page: Page) =>
  page.getByRole("button", { name: "Открыть меню", exact: true });
const serviceIds = ["counselling", "support-person", "courses", "home-help"];

async function expectNoOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

// Capture rendered intermediate frames, so a declared transition alone cannot pass.
async function opacityDuringActivation(trigger: Locator, selector: string) {
  return trigger.evaluate(async (element, target) => {
    const samples: number[] = [];
    (element as HTMLElement).click();
    const started = performance.now();
    while (performance.now() - started < 650) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const panel = document.querySelector(target);
      samples.push(panel ? Number(getComputedStyle(panel).opacity) : 0);
    }
    return samples;
  }, selector);
}

async function expectAtAnchor(page: Page, id: string) {
  await expect
    .poll(() =>
      page.locator(`#${id}`).evaluate((element) => {
        const root = document.documentElement;
        const padding =
          Number.parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
        const margin =
          Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
        const top = element.getBoundingClientRect().top + window.scrollY;
        const maxScroll = root.scrollHeight - window.innerHeight;
        const expected = Math.max(
          0,
          Math.min(maxScroll, top - padding - margin),
        );
        return Math.abs(window.scrollY - expected);
      }),
    )
    .toBeLessThanOrEqual(4);
}

test("desktop services opens a compact menu with visible enter/exit transitions and keyboard dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const trigger = desktopNavigation(page).getByRole("button", {
    name: "Услуги",
    exact: true,
  });
  const panel = page.locator("#services-mega-menu");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.focus();
  const opening = await opacityDuringActivation(trigger, "#services-mega-menu");
  expect(opening.some((value) => value > 0.02 && value < 0.98)).toBe(true);
  expect(opening.at(-1)).toBe(1);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL("http://127.0.0.1:5173/");
  await expect(panel.locator('a[href^="/services/#"]')).toHaveCount(4);
  await expect(
    panel.getByRole("link", { name: "Все услуги", exact: true }),
  ).toHaveAttribute("href", "/services/");
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeLessThan(520);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1440);
  const closing = await opacityDuringActivation(trigger, "#services-mega-menu");
  expect(closing.some((value) => value > 0.02 && value < 0.98)).toBe(true);
  expect(closing.at(-1)).toBe(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");

  await trigger.press("Enter");
  await expect(panel).toBeVisible();
  await panel.getByRole("link", { name: "Все услуги", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(4, 700);
  await expect(panel).not.toBeVisible();
  await expectNoOverflow(page);
});

test("service category navigation uses a real page path and preserves SPA Back/Forward history", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => {
    (
      window as Window & { navigationDocumentMarker?: string }
    ).navigationDocumentMarker = "same-document";
  });
  await desktopNavigation(page)
    .getByRole("button", { name: "Услуги", exact: true })
    .click();
  await page
    .locator('#services-mega-menu a[href="/services/#home-help"]')
    .click();
  await expect(page).toHaveURL(/\/services\/#home-help$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Поддержка, которая подходит вам",
  );
  await expectAtAnchor(page, "home-help");
  await expect(
    page.getByRole("dialog", { name: "Помощь на дому", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator("#services-mega-menu")).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { navigationDocumentMarker?: string })
          .navigationDocumentMarker,
    ),
  ).toBe("same-document");
  await page.goBack();
  await expect(page).toHaveURL("http://127.0.0.1:5173/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Рядом, когда",
  );
  await page.goForward();
  await expect(page).toHaveURL(/\/services\/#home-help$/);
  await expectAtAnchor(page, "home-help");
  await page.reload();
  await expect(page).toHaveURL(/\/services\/#home-help$/);
  await expectAtAnchor(page, "home-help");
  await desktopNavigation(page)
    .getByRole("link", { name: "Команда", exact: true })
    .click();
  await expect(page).toHaveURL(/\/team\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Люди, которым важно ваше благополучие",
  );
  await desktopNavigation(page)
    .getByRole("link", { name: "О нас", exact: true })
    .click();
  await expect(page).toHaveURL(/\/#about$/);
  await expectAtAnchor(page, "about");
  await page.goBack();
  await expect(page).toHaveURL(/\/team\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Люди, которым важно ваше благополучие",
  );
});

test("Back and Forward restore a page scrolled since the last navigation click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await desktopNavigation(page)
    .getByRole("button", { name: "Услуги", exact: true })
    .click();
  await page
    .locator("#services-mega-menu")
    .getByRole("link", { name: "Все услуги", exact: true })
    .click();
  await expect(page).toHaveURL(/\/services\/$/);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    window.scrollTo({ top: 1500, behavior: "instant" }),
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1500);
  // Allow the passive scroll event to run; no link click may save this position.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.goBack();
  await expect(page).toHaveURL("http://127.0.0.1:5173/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Рядом, когда",
  );
  await page.goForward();
  await expect(page).toHaveURL(/\/services\/$/);
  await expect
    .poll(() => page.evaluate(() => Math.abs(window.scrollY - 1500)))
    .toBeLessThanOrEqual(2);
});

test("standalone services and team survive direct visits and reload with distinct metadata and existing content", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const pages = [
    {
      path: "/services/",
      title: /Услуги.*Sotsiaal Kodu/,
      heading: "Поддержка, которая подходит вам",
    },
    {
      path: "/team/",
      title: /Команда.*Sotsiaal Kodu/,
      heading: "Люди, которым важно ваше благополучие",
    },
  ];
  for (const entry of pages) {
    await page.goto(entry.path);
    await expect(page).toHaveTitle(entry.title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      entry.heading,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S{10,}/,
    );
    await page.reload();
    await expect(page).toHaveTitle(entry.title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      entry.heading,
    );
    if (entry.path === "/services/") {
      for (const id of serviceIds) {
        await expect(
          page.locator(`article#${id}`).getByRole("heading", { level: 2 }),
        ).toBeVisible();
      }
      await page
        .locator("article#support-person")
        .getByRole("button", { name: "Записаться на встречу", exact: true })
        .click();
      const booking = page.locator("dialog.booking-dialog");
      await expect(booking).toBeVisible();
      await expect(
        booking.getByRole("radio", {
          name: "Услуги опорного лица",
          exact: true,
        }),
      ).toBeChecked();
      await page.keyboard.press("Escape");
      await expect(booking).not.toBeVisible();
      await expect(page).toHaveURL(/\/services\/$/);
    } else {
      for (const [id, name] of [
        ["natalia", "Наталья Умарова"],
        ["eduard", "Эдуард Ист"],
      ]) {
        const portrait = page.getByRole("button", { name, exact: true });
        await expect(portrait).toBeVisible();
        await portrait.click();
        await expect(portrait).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator(`#team-panel-${id}`)).toBeVisible();
        await expect(
          page.locator('.team-card[data-active="true"]'),
        ).toHaveCount(1);
      }
    }
    await expectNoOverflow(page);
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 320]) {
  test(`mobile menu fills ${width}px screen, holds scroll and keyboard focus, and restores the opener`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(() =>
      window.scrollTo({ top: 90, behavior: "instant" }),
    );
    await menuToggle(page).scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await menuToggle(page).click();
    const menu = mobileMenu(page);
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeCloseTo(0, 0);
    expect(bounds!.y).toBeCloseTo(0, 0);
    expect(bounds!.width).toBeCloseTo(width, 0);
    expect(bounds!.height).toBeCloseTo(844, 0);
    await expect(
      menu.getByRole("link", { name: "Команда", exact: true }),
    ).toHaveAttribute("href", "/team/");
    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(before, 0);
    await menu.getByRole("button", { name: "Услуги", exact: true }).click();
    await expect(menu.locator('a[href^="/services/#"]')).toHaveCount(4);
    for (let index = 0; index < 18; index += 1) {
      await page.keyboard.press("Tab");
      expect(
        await menu.evaluate(
          (element) =>
            element.contains(document.activeElement) || !document.hasFocus(),
        ),
      ).toBe(true);
    }
    await expectNoOverflow(page);
    expect(
      await menu.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(menuToggle(page)).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(before, 0);
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
    ).not.toBe("hidden");
    await menuToggle(page).click();
    await menu.getByRole("button", { name: "Услуги", exact: true }).click();
    await menu.getByRole("link", { name: "Все услуги", exact: true }).click();
    await expect(menu).not.toBeVisible();
    await expect(page).toHaveURL(/\/services\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Поддержка, которая подходит вам",
    );
    await expectNoOverflow(page);
  });
}

test("mobile navigation animates in and out, then hands focus to booking after the menu closes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const opening = await opacityDuringActivation(
    menuToggle(page),
    "#mobile-navigation",
  );
  expect(opening.some((value) => value > 0.02 && value < 0.98)).toBe(true);
  expect(opening.at(-1)).toBe(1);
  const closing = await opacityDuringActivation(
    mobileMenu(page).getByRole("button", { name: "Закрыть меню", exact: true }),
    "#mobile-navigation",
  );
  expect(closing.some((value) => value > 0.02 && value < 0.98)).toBe(true);
  expect(closing.at(-1)).toBe(0);
  await expect(mobileMenu(page)).not.toBeVisible();
  await menuToggle(page).click();
  await mobileMenu(page)
    .getByRole("button", { name: "Записаться на встречу", exact: true })
    .click();
  await expect(mobileMenu(page)).not.toBeVisible();
  const booking = page.locator("dialog.booking-dialog");
  await expect(booking).toBeVisible();
  await expect(
    booking.getByRole("heading", { name: "С чего начнём?", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(booking).not.toBeVisible();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
  ).not.toBe("hidden");
});

test("menu motion respects both system and saved accessibility preferences", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const preference of ["system", "widget"] as const) {
    await page.emulateMedia({
      reducedMotion: preference === "system" ? "reduce" : "no-preference",
    });
    await page.goto("/");
    if (preference === "widget") {
      const settings = await openAccessibility(page);
      await settings
        .getByRole("checkbox", { name: "Меньше движения", exact: true })
        .check();
      await closeAccessibility(page);
    }
    const trigger = desktopNavigation(page).getByRole("button", {
      name: "Услуги",
      exact: true,
    });
    const samples = await opacityDuringActivation(
      trigger,
      "#services-mega-menu",
    );
    expect(samples.every((value) => value === 0 || value === 1)).toBe(true);
    expect(samples.at(-1)).toBe(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("#services-mega-menu")).not.toBeVisible();
  }
});

test("new pages and expanded mobile services remain usable with 200% text at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/services/");
  await setTextSize(page, "200%");
  for (const path of ["/services/", "/team/"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoOverflow(page);
    await menuToggle(page).click();
    const menu = mobileMenu(page);
    await menu.getByRole("button", { name: "Услуги", exact: true }).click();
    const allServices = menu.getByRole("link", {
      name: "Все услуги",
      exact: true,
    });
    await allServices.scrollIntoViewIfNeeded();
    await expect(allServices).toBeInViewport();
    expect(
      await menu.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(menuToggle(page)).toBeFocused();
  }
});
