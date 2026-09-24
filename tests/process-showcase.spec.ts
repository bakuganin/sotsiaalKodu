import { test, expect } from "./fixtures";

const coverTitles = [
  "Начнём с простого разговора",
  "Поддержка, которая подходит вам",
  "Встретимся в удобное время",
];
const coverDescriptions = [
  "Расскажите, что вас беспокоит и какая помощь нужна. Мы внимательно выслушаем вас или вашего близкого.",
  "Вместе разберёмся в вашей ситуации, обсудим варианты помощи и выберем посильный следующий шаг.",
  "Согласуем время и формат первой встречи. Обсудим детали, чтобы вы знали, чего ожидать.",
];

for (const width of [1440, 390]) {
  test(`process tabs, arrows and contact work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const section = page.locator(".process-showcase");
    await section.scrollIntoViewIfNeeded();
    const tabs = section.getByRole("tab");
    await expect(tabs).toHaveCount(3);
    await expect(section.getByRole("tabpanel")).toHaveCount(1);
    await expect(section.getByRole("tabpanel")).toContainText(
      "Расскажите о себе",
    );
    const seenCovers = new Set<string>();
    const seenDetails = new Set<string>();
    async function checkSlide(index: number) {
      const copy = section.locator('.process-cover-slide[data-active="true"]');
      await expect(section.getByRole("heading", { level: 2 })).toHaveText(
        coverTitles[index],
      );
      await expect(copy.locator("p")).toHaveText(coverDescriptions[index]);
      await expect(copy).toHaveCSS("opacity", "1");
      await expect(section.locator("#process-title")).toHaveCount(1);
      for (const [selector, seen] of [
        [".process-cover-image", seenCovers],
        [".process-detail-image", seenDetails],
      ] as const) {
        const image = section.locator(`${selector}[data-active="true"]`);
        await expect(image).toHaveCount(1);
        await expect(image).toHaveCSS("opacity", "1");
        await image.evaluate((element: HTMLImageElement) => element.decode());
        seen.add((await image.getAttribute("src"))!);
        for (const inactive of await section
          .locator(`${selector}[data-active="false"]`)
          .all()) {
          await expect(inactive).toHaveCSS("opacity", "0");
        }
      }
    }
    await checkSlide(0);
    const before = await section.boundingBox();
    await tabs.nth(1).click();
    await expect(section.getByRole("tabpanel")).toContainText(
      "Найдём подходящую помощь",
    );
    await checkSlide(1);
    await section.getByRole("button", { name: "Следующий шаг" }).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await checkSlide(2);
    expect(seenCovers.size).toBe(3);
    expect(seenDetails.size).toBe(3);
    await section.getByRole("button", { name: "Следующий шаг" }).click();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await checkSlide(0);
    await tabs.nth(0).focus();
    await page.keyboard.press("End");
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(2)).toBeFocused();
    await checkSlide(2);
    const after = await section.boundingBox();
    expect(Math.abs(after!.height - before!.height)).toBeLessThan(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await section.getByRole("button", { name: "Связаться с нами" }).click();
    await expect(page.locator("dialog[open]")).toBeVisible();
  });
}

test("process transition has intermediate frames and honors reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const section = page.locator(".process-showcase");
  await section.scrollIntoViewIfNeeded();
  const samples = await section.evaluate(async (el) => {
    const panel = el.querySelectorAll(".process-step-panel")[1];
    (el.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click();
    const cover = el.querySelectorAll(".process-cover-slide")[1];
    const values: { panel: number; cover: number }[] = [];
    const start = performance.now();
    while (performance.now() - start < 550) {
      await new Promise(requestAnimationFrame);
      values.push({
        panel: Number(getComputedStyle(panel).opacity),
        cover: Number(getComputedStyle(cover).opacity),
      });
    }
    return values;
  });
  expect(samples.some(({ panel }) => panel > 0 && panel < 1)).toBe(true);
  expect(samples.some(({ cover }) => cover > 0 && cover < 1)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await section.getByRole("tab").nth(2).click();
  await expect(section.getByRole("tabpanel")).toContainText(
    "Договоримся о встрече",
  );
  expect(
    await section
      .locator(".process-step-panel")
      .last()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  await expect(
    section.locator('.process-cover-slide[data-active="true"]'),
  ).toHaveCSS("transition-duration", "0s");
});
