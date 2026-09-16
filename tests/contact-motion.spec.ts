import { expect, test } from "./fixtures";

test.use({ reducedMotion: "no-preference" });

for (const width of [1440, 390]) {
  test(`contact panels reveal without changing geometry or replaying at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const pair = page.locator(".contact-panels");
    await expect(pair).toHaveAttribute("data-motion-state", "pending");

    const samples = await pair.evaluate(async (element) => {
      const pair = element as HTMLElement;
      const layers = [...pair.children] as HTMLElement[];
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
    expect(samples.starts).toHaveLength(2);
    expect(
      Math.max(...samples.frames.map(({ overflow }) => overflow)),
    ).toBeLessThanOrEqual(1);
    for (const index of [0, 1]) {
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

test("reduced motion shows the contact panels immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const pair = page.locator(".contact-panels");
  await pair.scrollIntoViewIfNeeded();
  await expect(pair).toHaveAttribute("data-motion-state", "settled");
  for (const panel of await pair.locator(":scope > *").all()) {
    await expect(panel).toHaveCSS("opacity", "1");
    await expect(panel).toHaveCSS("animation-name", "none");
    await expect(panel).toHaveCSS("clip-path", "none");
  }
});
