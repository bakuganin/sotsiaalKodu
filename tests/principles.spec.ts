import { expect, test, type Page } from "./fixtures";
import { closeAccessibility, openAccessibility } from "./accessibility-helpers";

const scene = (page: Page) => page.locator(".principles-scene");
const cards = (page: Page) => scene(page).locator(".principle-card");

async function expectRevealed(page: Page) {
  await expect(scene(page).locator('[data-revealed="true"]')).toHaveCount(3);
  for (const card of await cards(page).all()) {
    await expect(card).toHaveCSS("opacity", "1");
  }
}

test("principles fade in on scroll and remain visible when revisited", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(scene(page)).toHaveAttribute("data-reveal-ready", "true");
  await expect(scene(page).locator('[data-revealed="true"]')).toHaveCount(0);
  await expect(cards(page).first()).toHaveCSS("opacity", "0");

  const opacityFrames = await cards(page)
    .first()
    .evaluate(async (card) => {
      const samples: number[] = [];
      card.scrollIntoView({ block: "center", behavior: "instant" });
      const started = performance.now();
      do {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        samples.push(Number(getComputedStyle(card).opacity));
      } while (performance.now() - started < 1500 && samples.at(-1)! < 0.999);
      return samples;
    });
  expect(opacityFrames.some((opacity) => opacity > 0 && opacity < 1)).toBe(
    true,
  );

  for (const card of await cards(page).all()) {
    await card.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await expect(card).toHaveAttribute("data-revealed", "true");
    await expect(card).toHaveCSS("opacity", "1");
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expectRevealed(page);
  await scene(page).scrollIntoViewIfNeeded();
  await expectRevealed(page);
});

test("system reduced motion reveals pending principles immediately and persists", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(cards(page).first()).toHaveCSS("opacity", "0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectRevealed(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expectRevealed(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expectRevealed(page);
});

test("accessibility motion setting reveals every pending card without scrolling", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(cards(page).first()).toHaveCSS("opacity", "0");
  const dialog = await openAccessibility(page);
  await dialog
    .getByRole("checkbox", { name: "Меньше движения", exact: true })
    .check();
  await expectRevealed(page);
  await dialog
    .getByRole("checkbox", { name: "Меньше движения", exact: true })
    .uncheck();
  await closeAccessibility(page);
  await expectRevealed(page);
});

test("principles remain readable without IntersectionObserver", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", { value: undefined });
  });
  await page.goto("/");
  await expectRevealed(page);
  await expect(scene(page)).not.toHaveAttribute("data-reveal-ready", "true");
});
