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

for (const width of [1440, 390]) {
  test(`all support cards float without hover at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const section = page.locator(".support-invitation");
    const scene = section.locator(".support-world-scene");
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveAttribute("data-motion-state", "settled");
    await expect(scene).toHaveAttribute("data-floating", "true");
    await expect(section.locator(".support-world-word")).toHaveText(
      "SOTSIAAL KODU",
    );
    await page.mouse.move(0, 0);

    const ranges = await scene.evaluate(async (element) => {
      const cards = [
        ...element.querySelectorAll(".support-world-card-surface"),
      ];
      const samples = cards.map(() => [] as number[]);
      const start = performance.now();
      while (performance.now() - start < 1000) {
        await new Promise(requestAnimationFrame);
        cards.forEach((card, i) => {
          samples[i].push(
            new DOMMatrixReadOnly(getComputedStyle(card).transform).m42,
          );
        });
      }
      return samples.map((values) => Math.max(...values) - Math.min(...values));
    });
    expect(ranges).toHaveLength(6);
    ranges.forEach((range) => expect(range).toBeGreaterThan(0.4));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(scene).toHaveAttribute("data-floating", "false");
    for (const card of await scene
      .locator(".support-world-card-surface")
      .all()) {
      await expect(card).toHaveCSS("animation-play-state", "paused");
    }
    await section.scrollIntoViewIfNeeded();
    await expect(scene).toHaveAttribute("data-floating", "true");
    await page.locator(".a11y-launcher").click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await expect(scene).toHaveAttribute("data-floating", "false");
  });
}

test("cursor only highlights cards without changing their motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const section = page.locator(".support-invitation");
  const scene = section.locator(".support-world-scene");
  const cards = scene.locator(".support-world-card");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute("data-motion-state", "settled");
  const bounds = await scene.boundingBox();
  const surfaces = scene.locator(".support-world-card-surface");
  // Hold the ambient animation at a fixed point to isolate the cursor's effect.
  await surfaces.evaluateAll(async (elements) => {
    const animations = elements.flatMap((e) => e.getAnimations());
    animations.forEach((animation) => animation.pause());
    await Promise.all(animations.map((animation) => animation.ready));
  });
  const original = await surfaces.evaluateAll((elements) =>
    elements.map((e) => getComputedStyle(e).transform),
  );
  const restingShadow = await surfaces
    .first()
    .evaluate((e) => getComputedStyle(e).boxShadow);
  for (const x of [60, bounds!.width - 60]) {
    await scene.hover({ position: { x, y: bounds!.height / 2 } });
    expect(
      await surfaces.evaluateAll((elements) =>
        elements.map((e) => getComputedStyle(e).transform),
      ),
    ).toEqual(original);
    for (const card of await cards.all())
      await expect(card).toHaveCSS("transform", "none");
  }
  await surfaces.first().hover();
  await expect
    .poll(() => surfaces.first().evaluate((e) => getComputedStyle(e).boxShadow))
    .not.toBe(restingShadow);
  await expect(surfaces.first()).not.toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  expect(
    await surfaces.evaluateAll((elements) =>
      elements.map((e) => getComputedStyle(e).transform),
    ),
  ).toEqual(original);
  await page.mouse.move(0, 0);
  await expect(surfaces.first()).toHaveCSS("box-shadow", restingShadow);
  await expect(surfaces.first()).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );

  for (const preference of ["system", "site"]) {
    if (preference === "system")
      await page.emulateMedia({ reducedMotion: "reduce" });
    else {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.evaluate(
        () => (document.documentElement.dataset.a11yReduceMotion = "true"),
      );
    }
    await scene.hover({ position: { x: 60, y: bounds!.height / 2 } });
    for (const card of await cards.all()) {
      await expect(card).toHaveCSS("transform", "none");
      await expect(card.locator(".support-world-card-surface")).toHaveCSS(
        "animation-name",
        "none",
      );
      await expect(card.locator(".support-world-card-surface")).toHaveCSS(
        "transform",
        "none",
      );
    }
  }
});
