import { test, expect } from "./fixtures";

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
    const before = await section.boundingBox();
    await tabs.nth(1).click();
    await expect(section.getByRole("tabpanel")).toContainText(
      "Найдём подходящую помощь",
    );
    await section.getByRole("button", { name: "Следующий шаг" }).click();
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await section.getByRole("button", { name: "Следующий шаг" }).click();
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(0).focus();
    await page.keyboard.press("End");
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(2)).toBeFocused();
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
    const values: number[] = [];
    const start = performance.now();
    while (performance.now() - start < 550) {
      await new Promise(requestAnimationFrame);
      values.push(Number(getComputedStyle(panel).opacity));
    }
    return values;
  });
  expect(samples.some((x) => x > 0 && x < 1)).toBe(true);
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
});
