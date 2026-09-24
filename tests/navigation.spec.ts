import { expect, test, type Locator, type Page } from "./fixtures";
import { closeAccessibility, openAccessibility } from "./accessibility-helpers";

const homeHelp = (page: Page) =>
  page.getByRole("dialog", { name: "Помощь на дому", exact: true });
const heroTrigger = (page: Page) =>
  page.locator('.hero-shortcut[href="#/services/home-help"]');
const gridTrigger = (page: Page) =>
  page.locator('.services-grid a[href="#/services/home-help"]');
const navigation = (page: Page) =>
  page.getByRole("navigation", { name: "Основная навигация" });

// Observe actual browser scroll positions, not merely the requested behavior.
async function sampleActivation(trigger: Locator) {
  return trigger.evaluate(async (element) => {
    const samples = [window.scrollY];
    (element as HTMLElement).click();
    const started = performance.now();
    let stillFrames = 0;
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const previous = samples.at(-1)!;
      samples.push(window.scrollY);
      stillFrames =
        Math.abs(window.scrollY - previous) < 0.5 ? stillFrames + 1 : 0;
    } while (
      // Mobile links wait for the closing animation before scrolling.
      performance.now() - started < 600 ||
      (stillFrames < 8 && performance.now() - started < 3000)
    );
    return samples;
  });
}

async function settledScroll(page: Page) {
  return page.evaluate(async () => {
    const started = performance.now();
    let previous = window.scrollY;
    let stillFrames = 0;
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      stillFrames =
        Math.abs(window.scrollY - previous) < 0.5 ? stillFrames + 1 : 0;
      previous = window.scrollY;
    } while (
      performance.now() - started < 180 ||
      (stillFrames < 8 && performance.now() - started < 3000)
    );
    return window.scrollY;
  });
}

function expectSmooth(samples: number[]) {
  const first = samples[0];
  const last = samples.at(-1)!;
  expect(Math.abs(last - first)).toBeGreaterThan(300);
  const low = Math.min(first, last) + 2;
  const high = Math.max(first, last) - 2;
  expect(
    samples.filter((value) => value > low && value < high).length,
  ).toBeGreaterThan(2);
}

function expectInstant(samples: number[]) {
  const first = samples[0];
  const last = samples.at(-1)!;
  expect(Math.abs(last - first)).toBeGreaterThan(300);
  // React may commit on the next frame; no frame may show partial travel.
  expect(
    samples.every(
      (value) => Math.abs(value - first) <= 2 || Math.abs(value - last) <= 2,
    ),
  ).toBe(true);
}

async function expectAtSection(page: Page, id: string) {
  await expect
    .poll(() =>
      page.locator(`#${id}`).evaluate((section) => {
        const root = document.documentElement;
        const padding =
          parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
        const margin =
          parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
        const top = section.getBoundingClientRect().top + window.scrollY;
        const maximum = root.scrollHeight - window.innerHeight;
        const target = Math.min(maximum, Math.max(0, top - padding - margin));
        return Math.abs(window.scrollY - target);
      }),
    )
    .toBeLessThanOrEqual(3);
}

async function resetToTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

test("closing a hero service with X, Escape or backdrop keeps scroll and opener focus", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo({ top: 70, behavior: "instant" }));

  for (const closing of ["button", "escape", "backdrop"] as const) {
    const trigger = heroTrigger(page);
    // Measure after Playwright reveals the trigger, so its automatic scrolling
    // cannot be mistaken for a jump caused by opening or closing the dialog.
    await trigger.scrollIntoViewIfNeeded();
    const before = await settledScroll(page);
    await trigger.click();
    await expect(homeHelp(page)).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(before, 0);

    if (closing === "button") {
      await homeHelp(page)
        .getByRole("button", { name: "Закрыть", exact: true })
        .click();
    } else if (closing === "escape") {
      await page.keyboard.press("Escape");
    } else {
      // Far outside the centred dialog, away from the accessibility launcher.
      await page.mouse.click(4, 4);
    }

    await expect(homeHelp(page)).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await settledScroll(page)).toBeCloseTo(before, 0);
    await expect(page).not.toHaveURL(/#\/services\//);
  }
});

test("service grid dismissal and browser Back/Forward retain the originating position", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const trigger = gridTrigger(page);
  await trigger.evaluate((element) =>
    element.scrollIntoView({
      behavior: "instant",
      block: "center",
    }),
  );
  await trigger.focus();
  const before = await settledScroll(page);
  expect(before).toBeGreaterThan(1000);
  await trigger.click();
  await expect(homeHelp(page)).toBeVisible();
  await homeHelp(page)
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await expect(homeHelp(page)).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await settledScroll(page)).toBeCloseTo(before, 0);

  await trigger.click();
  await expect(homeHelp(page)).toBeVisible();
  await page.goBack();
  await expect(homeHelp(page)).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await settledScroll(page)).toBeCloseTo(before, 0);
  await page.goForward();
  await expect(page).toHaveURL(/#\/services\/home-help$/);
  await expect(homeHelp(page)).toBeVisible();
  expect(await settledScroll(page)).toBeCloseTo(before, 0);
  await page.keyboard.press("Escape");
  await expect(homeHelp(page)).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await settledScroll(page)).toBeCloseTo(before, 0);
});

test("a direct service URL closes safely even after reload without navigating away", async ({
  page,
}) => {
  await page.goto("/#/services/home-help");
  await expect(homeHelp(page)).toBeVisible();
  await page.reload();
  await expect(homeHelp(page)).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  await homeHelp(page)
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await expect(homeHelp(page)).not.toBeVisible();
  await expect(page).not.toHaveURL(/#\/services\//);
  expect(new URL(page.url()).pathname).toBe("/");
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:5173");
  expect(await settledScroll(page)).toBeCloseTo(before, 0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("services CTA and desktop/mobile navigation scroll smoothly, including a repeated hash", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await heroTrigger(page).click();
  const allServices = homeHelp(page).getByText("Все услуги", { exact: true });
  await expect(allServices).toBeVisible();
  expectSmooth(await sampleActivation(allServices));
  await expect(homeHelp(page)).not.toBeVisible();
  await expect(page).toHaveURL(/#services$/);
  await expectAtSection(page, "services");

  // These destinations remain home sections; services, team and contacts have pages.
  for (const id of ["about", "events", "about"]) {
    const link = navigation(page).locator(`a[href="/#${id}"]`);
    await resetToTop(page);
    expectSmooth(await sampleActivation(link));
    await expectAtSection(page, id);
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await resetToTop(page);
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  const mobileLink = page
    .getByRole("dialog", { name: "Основная навигация" })
    .getByRole("link", {
      name: "О нас",
      exact: true,
    });
  expectSmooth(await sampleActivation(mobileLink));
  await expect(
    page.getByRole("dialog", { name: "Основная навигация" }),
  ).not.toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/menu-open/);
  await expectAtSection(page, "about");
});

test("system and accessibility reduced motion make services CTA and navigation immediate", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const preference of ["system", "widget"] as const) {
    await page.emulateMedia({
      reducedMotion: preference === "system" ? "reduce" : "no-preference",
    });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    if (preference === "widget") {
      const settings = await openAccessibility(page);
      await settings
        .getByRole("checkbox", { name: "Меньше движения", exact: true })
        .check();
      await closeAccessibility(page);
      await expect(page.locator("html")).toHaveAttribute(
        "data-a11y-reduce-motion",
        "true",
      );
    }
    await heroTrigger(page).click();
    expectInstant(
      await sampleActivation(
        homeHelp(page).getByText("Все услуги", { exact: true }),
      ),
    );
    await expect(homeHelp(page)).not.toBeVisible();
    await expectAtSection(page, "services");
    await resetToTop(page);
    expectInstant(
      await sampleActivation(
        navigation(page).getByRole("link", { name: "О нас", exact: true }),
      ),
    );
    await expectAtSection(page, "about");
  }
});
