import { expect, test } from "./fixtures";

test.use({ reducedMotion: "no-preference" });

test("mouse hover opens services, crosses into the cards, and closes with painted exit frames", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const trigger = page.locator(".sk-services-trigger");
  const panel = page.locator("#services-mega-menu");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  const before = await trigger.boundingBox();
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("#services-mega-menu")!;
    const frames: { opacity: number; open: boolean }[] = [];
    Object.assign(window, { __megaFrames: frames });
    const started = performance.now();
    const sample = () => {
      frames.push({
        opacity: Number(getComputedStyle(panel).opacity),
        open: panel.dataset.open === "true",
      });
      if (performance.now() - started < 6000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await trigger.hover();
  await expect(panel).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    focused,
  );
  const after = await trigger.boundingBox();
  expect(after!.y).toBeCloseTo(before!.y, 1);
  const bounds = await panel.boundingBox();
  // Move slowly through the space below the trigger; the hover region includes
  // this bridge and all four cards, not only the text in the navigation bar.
  await page.mouse.move(before!.x + before!.width / 2, bounds!.y + 8, {
    steps: 12,
  });
  await page.waitForTimeout(230);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await panel.locator(".sk-mega-card").last().hover();
  await page.waitForTimeout(230);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.mouse.move(1400, 800);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(panel).not.toBeVisible();
  const frames = await page.evaluate(
    () =>
      (
        window as unknown as {
          __megaFrames: { opacity: number; open: boolean }[];
        }
      ).__megaFrames,
  );
  expect(
    frames.filter((f) => f.open && f.opacity > 0.03 && f.opacity < 0.97).length,
  ).toBeGreaterThan(2);
  expect(
    frames.filter((f) => !f.open && f.opacity > 0.03 && f.opacity < 0.97)
      .length,
  ).toBeGreaterThan(2);
  await expect(panel).toHaveJSProperty("inert", true);
});

test("brief mouse exits do not flicker; click and keyboard remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/services/");
  const trigger = page.locator(".sk-services-trigger");
  const panel = page.locator("#services-mega-menu");
  await trigger.hover();
  await expect(panel).toHaveCSS("opacity", "1");
  await page.mouse.move(1400, 800);
  await trigger.hover();
  await page.waitForTimeout(200);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await trigger.click();
  await expect(panel).toBeVisible();
  await trigger.click();
  await expect(panel).not.toBeVisible();
  await page.mouse.move(1400, 800);
  await trigger.press("ArrowDown");
  await expect(panel.locator(".sk-mega-card").first()).toBeFocused();
  await page.waitForTimeout(230);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await panel.getByRole("link", { name: "Все услуги", exact: true }).click();
  await expect(panel).not.toBeVisible();
});

test("touch does not activate hover, and reduced motion keeps hover instant", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const trigger = page.locator(".sk-services-trigger");
  const panel = page.locator("#services-mega-menu");
  await trigger.dispatchEvent("pointerover", {
    pointerType: "touch",
    bubbles: true,
  });
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.hover();
  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("transition-duration", "0s");
  await page.mouse.move(1400, 800);
  await expect(panel).not.toBeVisible();
});
