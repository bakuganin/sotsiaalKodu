import { expect, test, type Locator, type Page } from "./fixtures";

const group = (page: Page, variant: "faq") =>
  page.locator(`.${variant}-list.animated-accordion`);

async function waitForTransitions(accordion: Locator) {
  await expect
    .poll(() =>
      accordion.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    )
    .toBe(0);
}

async function sampleToggle(item: Locator) {
  return item.evaluate(async (element) => {
    const panel = element.querySelector<HTMLElement>(".accordion-panel")!;
    const button =
      element.querySelector<HTMLButtonElement>(".accordion-trigger")!;
    const measure = () => ({
      height: panel.getBoundingClientRect().height,
      opacity: Number(getComputedStyle(panel).opacity),
    });
    const samples = [measure()];
    button.click();
    const started = performance.now();
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      samples.push(measure());
    } while (
      performance.now() - started < 100 ||
      (performance.now() - started < 1800 &&
        element
          .getAnimations({ subtree: true })
          .some((animation) => animation.playState === "running"))
    );
    return samples;
  });
}

test("FAQ answers interpolate height and opacity when opening and closing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    for (const variant of ["faq"] as const) {
      const accordion = group(page, variant);
      const item = accordion.locator(".accordion-item").first();
      await accordion.scrollIntoViewIfNeeded();
      const initialOpen = false;
      await expect(item).toHaveAttribute("data-open", String(initialOpen));

      for (const opening of [!initialOpen, initialOpen]) {
        const frames = await sampleToggle(item);
        const first = frames[0];
        const last = frames.at(-1)!;
        const low = Math.min(first.height, last.height);
        const high = Math.max(first.height, last.height);
        expect(high - low).toBeGreaterThan(20);
        expect(low).toBeLessThanOrEqual(1);
        expect(
          frames.filter(
            (frame) => frame.height > low + 2 && frame.height < high - 2,
          ).length,
        ).toBeGreaterThan(2);
        expect(
          frames.some((frame) => frame.opacity > 0 && frame.opacity < 1),
        ).toBe(true);
        expect(last.opacity).toBe(opening ? 1 : 0);
        expect(
          opening ? last.height > first.height : last.height < first.height,
        ).toBe(true);
        await expect(item).toHaveAttribute("data-open", String(opening));
      }
    }
  }
});

test("native keyboard buttons expose only expanded panels to assistive technology", async ({
  page,
}) => {
  await page.goto("/");
  const faq = group(page, "faq");
  await expect(faq.getByRole("region")).toHaveCount(0);

  const allIds = await page
    .locator(".animated-accordion [id]")
    .evaluateAll((elements) => elements.map((element) => element.id));
  expect(new Set(allIds).size).toBe(allIds.length);

  for (const accordion of [faq]) {
    const item = accordion.locator(".accordion-item").nth(1);
    const trigger = item.getByRole("button");
    const panel = item.locator(".accordion-panel");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(
      await panel.evaluate((element) => (element as HTMLElement).inert),
    ).toBe(true);
    await expect(trigger).toHaveAttribute(
      "aria-controls",
      (await panel.getAttribute("id"))!,
    );
    await expect(panel).toHaveAttribute(
      "aria-labelledby",
      (await trigger.getAttribute("id"))!,
    );

    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toBeFocused();
    await expect(accordion.getByRole("region")).toHaveCount(1);
    await expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(
      await panel.evaluate((element) => (element as HTMLElement).inert),
    ).toBe(false);

    await page.keyboard.press("Space");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(accordion.getByRole("region")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(accordion.locator(".accordion-trigger").nth(2)).toBeFocused();
  }
});

test("exclusive selection and rapid reversals settle on the final requested state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  for (const variant of ["faq"] as const) {
    const accordion = group(page, variant);
    await accordion.scrollIntoViewIfNeeded();
    const states = await accordion.evaluate(async (element) => {
      const triggers =
        element.querySelectorAll<HTMLButtonElement>(".accordion-trigger");
      const results: number[][] = [];
      for (const index of [1, 2, 1, 1, 0, 2]) {
        triggers[index].click();
        const started = performance.now();
        do {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        } while (performance.now() - started < 65);
        results.push(
          [...triggers]
            .map((trigger, i) =>
              trigger.getAttribute("aria-expanded") === "true" ? i : -1,
            )
            .filter((i) => i >= 0),
        );
      }
      return results;
    });
    expect(states).toEqual([[1], [2], [1], [], [0], [2]]);
    await waitForTransitions(accordion);
    await expect(accordion.locator('[data-open="true"]')).toHaveCount(1);
    const heights = await accordion
      .locator(".accordion-panel")
      .evaluateAll((panels) =>
        panels.map((panel) => panel.getBoundingClientRect().height),
      );
    expect(heights[2]).toBeGreaterThan(20);
    expect(
      heights.filter((_, index) => index !== 2).every((height) => height < 1),
    ).toBe(true);
  }
});

test("system and live accessibility reduced-motion preferences remove accordion transitions", async ({
  page,
}) => {
  for (const preference of ["system", "accessibility"] as const) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    if (preference === "system") {
      await page.emulateMedia({ reducedMotion: "reduce" });
    } else {
      await page.evaluate(() =>
        document.documentElement.setAttribute(
          "data-a11y-reduce-motion",
          "true",
        ),
      );
    }
    const accordion = group(page, "faq");
    for (const opening of [true, false]) {
      const result = await accordion.evaluate(async (element) => {
        element.querySelector<HTMLButtonElement>(".accordion-trigger")!.click();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return {
          height: element
            .querySelector(".accordion-panel")!
            .getBoundingClientRect().height,
          running: element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
        };
      });
      expect(result.running).toBe(0);
      if (opening) expect(result.height).toBeGreaterThan(20);
      else expect(result.height).toBeLessThanOrEqual(1);
    }
  }
});
