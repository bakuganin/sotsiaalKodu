import { expect, test, type Page } from "./fixtures";
import { closeAccessibility, openAccessibility } from "./accessibility-helpers";

const composition = (page: Page) => page.locator(".intro-visual");
const pieces = (page: Page) =>
  composition(page).locator(".intro-branch, .intro-artworks > *");

async function waitForSiteReady(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
}

async function expectFullyVisible(page: Page) {
  for (const piece of await pieces(page).all()) {
    await expect(piece).toHaveCSS("opacity", "1");
  }
}

for (const width of [1440, 390]) {
  test(`intro composition appears sequentially and never replays at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await waitForSiteReady(page);
    await expect(composition(page)).toHaveAttribute(
      "data-reveal-ready",
      "true",
    );
    for (const piece of await pieces(page).all()) {
      await expect(piece).toHaveCSS("opacity", "0");
    }

    const samples = await composition(page).evaluate(async (visual) => {
      const elements = [
        visual.querySelector(".intro-branch")!,
        visual.querySelector(".intro-care")!,
        visual.querySelector(".intro-leaf")!,
        visual.querySelector(".intro-contact")!,
      ];
      const frames: { time: number; opacity: number[]; translate: string[] }[] =
        [];
      const started = performance.now();
      visual.scrollIntoView({ block: "center", behavior: "instant" });
      do {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const styles = elements.map((element) => getComputedStyle(element));
        frames.push({
          time: performance.now() - started,
          opacity: styles.map((style) => Number(style.opacity)),
          translate: styles.map((style) => style.translate),
        });
      } while (performance.now() - started < 1900);
      return frames;
    });
    await testInfo.attach("animation-frames", {
      body: JSON.stringify(samples, null, 2),
      contentType: "application/json",
    });

    for (let index = 0; index < 4; index++) {
      expect(
        samples.some(
          (frame) => frame.opacity[index] > 0 && frame.opacity[index] < 1,
        ),
      ).toBe(true);
    }
    const firstVisible = [0, 1, 2, 3].map((index) =>
      samples.findIndex((frame) => frame.opacity[index] > 0.01),
    );
    const expectedOrder = width > 760 ? [0, 1, 2, 3] : [0, 3, 2, 1];
    expect(
      [...expectedOrder].sort((a, b) => firstVisible[a] - firstVisible[b]),
    ).toEqual(expectedOrder);
    for (let step = 1; step < expectedOrder.length; step++) {
      const previousTime = samples[firstVisible[expectedOrder[step - 1]]].time;
      const currentTime = samples[firstVisible[expectedOrder[step]]].time;
      expect(currentTime - previousTime).toBeGreaterThan(65);
    }
    await expectFullyVisible(page);

    // Returning to the scene must not hide or animate its content again.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expectFullyVisible(page);
    const revisitedOpacities = await composition(page).evaluate(
      async (visual) => {
        const elements = [
          ...visual.querySelectorAll(".intro-branch, .intro-artworks > *"),
        ];
        const frames: number[][] = [];
        visual.scrollIntoView({ block: "center", behavior: "instant" });
        const started = performance.now();
        do {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          frames.push(
            elements.map((element) =>
              Number(getComputedStyle(element).opacity),
            ),
          );
        } while (performance.now() - started < 300);
        return frames;
      },
    );
    expect(
      revisitedOpacities.every((frame) =>
        frame.every((opacity) => opacity === 1),
      ),
    ).toBe(true);
  });
}

test("system and accessibility reduced motion reveal the pending composition immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForSiteReady(page);
  await expect(pieces(page).first()).toHaveCSS("opacity", "0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectFullyVisible(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expectFullyVisible(page);

  await page.reload();
  await waitForSiteReady(page);
  await expect(pieces(page).first()).toHaveCSS("opacity", "0");
  const dialog = await openAccessibility(page);
  await dialog
    .getByRole("checkbox", { name: "Меньше движения", exact: true })
    .check();
  await expectFullyVisible(page);
  await dialog
    .getByRole("checkbox", { name: "Меньше движения", exact: true })
    .uncheck();
  await expectFullyVisible(page);
  await dialog
    .getByRole("checkbox", { name: "Меньше движения", exact: true })
    .check();
  await closeAccessibility(page);
  await page.reload();
  await waitForSiteReady(page);
  await expectFullyVisible(page);
});

test("intro composition remains visible without IntersectionObserver", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", { value: undefined });
  });
  await page.goto("/");
  await waitForSiteReady(page);
  await expectFullyVisible(page);
});
