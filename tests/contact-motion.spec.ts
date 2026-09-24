import { expect, test } from "./fixtures";

test.use({ reducedMotion: "no-preference" });

for (const width of [1440, 390]) {
  test(`contact composition reveals without changing geometry or replaying at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const pair = page.locator(".support-invitation");
    await expect(pair).toHaveAttribute("data-motion-state", "pending");

    const samples = await pair.evaluate(async (element) => {
      const pair = element as HTMLElement;
      const layers = [pair];
      const starts: string[] = [];
      pair.addEventListener("animationstart", (event) => {
        if (
          event.target instanceof Element &&
          layers.includes(event.target as HTMLElement)
        )
          starts.push((event as AnimationEvent).animationName);
      });
      pair.scrollIntoView({ block: "center", behavior: "instant" });
      const started = performance.now();
      const frames: {
        state?: string;
        overflow: number;
        layers: { opacity: number; width: number; height: number; x: number }[];
      }[] = [];
      do {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        frames.push({
          state: pair.dataset.motionState,
          overflow: document.documentElement.scrollWidth - innerWidth,
          layers: layers.map((layer) => {
            const bounds = layer.getBoundingClientRect();
            return {
              opacity: Number(getComputedStyle(layer).opacity),
              width: bounds.width,
              height: bounds.height,
              x: bounds.x,
            };
          }),
        });
      } while (
        (frames.length < 10 || pair.dataset.motionState !== "settled") &&
        performance.now() - started < 5000
      );
      window.scrollTo({ top: 0, behavior: "instant" });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      pair.scrollIntoView({ block: "center", behavior: "instant" });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      return { frames, starts };
    });

    await testInfo.attach("contact-reveal-frames", {
      body: JSON.stringify(samples),
      contentType: "application/json",
    });
    expect(samples.frames.some(({ state }) => state === "running")).toBe(true);
    expect(samples.starts).toHaveLength(1);
    expect(
      Math.max(...samples.frames.map(({ overflow }) => overflow)),
    ).toBeLessThanOrEqual(1);
    for (const index of [0]) {
      for (const property of ["width", "height", "x"] as const) {
        const values = samples.frames.map(
          (frame) => frame.layers[index][property],
        );
        expect(
          Math.max(...values) - Math.min(...values),
          `panel ${index}: ${property}`,
        ).toBeLessThan(0.25);
      }
      const opacity = samples.frames.map(
        (frame) => frame.layers[index].opacity,
      );
      // The large surfaces should progress through intermediate values, rather
      // than becoming opaque almost immediately and shrinking afterwards.
      expect(
        opacity.filter((value) => value > 0.1 && value < 0.85).length,
      ).toBeGreaterThan(5);
      expect(opacity.at(-1)).toBe(1);
    }
    await expect(pair).toHaveAttribute("data-motion-state", "settled");
  });
}

test("reduced motion shows the contact composition immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const pair = page.locator(".support-invitation");
  await pair.scrollIntoViewIfNeeded();
  await expect(pair).toHaveAttribute("data-motion-state", "settled");
  await expect(pair).toHaveCSS("opacity", "1");
  await expect(pair).toHaveCSS("animation-name", "none");
  await expect(pair).toHaveCSS("clip-path", "none");
});

test("support cards follow the mouse, return to rest and respect motion preferences", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const section = page.locator(".support-invitation");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute("data-motion-state", "settled");
  await expect(section).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(section.getByRole("button")).toHaveCount(0);
  await expect(section).not.toContainText("Первый шаг к поддержке");

  const card = section.locator(".support-world-card").nth(3);
  const surface = card.locator(".support-world-card-surface");
  await expect(surface).toHaveCSS("font-weight", "600");
  const original = await card.boundingBox();
  await card.hover({ position: { x: 18, y: 22 } });
  await expect
    .poll(() => surface.evaluate((e) => getComputedStyle(e).transform))
    .not.toBe("none");
  const firstTransform = await surface.evaluate(
    (e) => getComputedStyle(e).transform,
  );
  await expect
    .poll(() =>
      card.evaluate((e) =>
        parseFloat(e.style.getPropertyValue("--card-rotate-y")),
      ),
    )
    .toBeLessThan(0);
  await card.hover({
    position: { x: original!.width - 18, y: original!.height - 22 },
  });
  await expect
    .poll(() =>
      card.evaluate((e) =>
        parseFloat(e.style.getPropertyValue("--card-rotate-y")),
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() => surface.evaluate((e) => getComputedStyle(e).transform))
    .not.toBe(firstTransform);
  expect(await card.boundingBox()).toEqual(original);

  await page.mouse.move(0, 0);
  await expect(surface).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await card.hover();
  await expect(surface).toHaveCSS("transform", "none");

  await page.mouse.move(0, 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(
    () => (document.documentElement.dataset.a11yReduceMotion = "true"),
  );
  await card.hover();
  await expect(surface).toHaveCSS("transform", "none");

  await page.mouse.move(0, 0);
  await page.evaluate(
    () => (document.documentElement.dataset.a11yReduceMotion = "false"),
  );
  await card.dispatchEvent("pointermove", {
    pointerType: "touch",
    clientX: 20,
    clientY: 20,
  });
  await expect(surface).toHaveCSS("transform", "none");
  expect(
    await card.evaluate((e) => e.style.getPropertyValue("--card-rotate-y")),
  ).toBe("");
});
