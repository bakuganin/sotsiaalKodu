import { expect, test, type Locator, type Page } from "./fixtures";
import { closeAccessibility, openAccessibility } from "./accessibility-helpers";

test.use({ reducedMotion: "no-preference" });

const cards = (page: Page) => page.locator(".services-grid .service-card");
const booking = (page: Page) => page.locator("dialog.booking-dialog");

async function expectSettled(target: Locator) {
  await expect(target).toHaveAttribute("data-motion-state", "settled");
  await expect(target).toHaveCSS("opacity", "1");
}

// Ignore translation and opacity: these samples distinguish the layered shape
// and depth reveal from an ordinary fade/slide, using actual painted frames.
async function captureReveal(target: Locator) {
  return target.evaluate(async (element) => {
    const node = element as HTMLElement;
    const layers = [node, ...node.children];
    const frames: { state?: string; shapes: string[] }[] = [];
    const started = performance.now();
    node.scrollIntoView({ block: "center", behavior: "instant" });
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      frames.push({
        state: node.dataset.motionState,
        shapes: layers.map((layer) => {
          const style = getComputedStyle(layer);
          const matrix = new DOMMatrixReadOnly(style.transform);
          return JSON.stringify({
            clip: style.clipPath,
            rotate: style.rotate,
            scale: style.scale,
            shape: [
              matrix.m11,
              matrix.m12,
              matrix.m13,
              matrix.m21,
              matrix.m22,
              matrix.m23,
              matrix.m31,
              matrix.m32,
              matrix.m33,
            ].map((value) => Number(value.toFixed(5))),
          });
        }),
      });
    } while (
      (frames.length < 8 || node.dataset.motionState !== "settled") &&
      performance.now() - started < 5000
    );
    return frames;
  });
}

test("service cards unfold with changing shape/depth and stay revealed on return", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const first = cards(page).first();
  await expect(first).toHaveAttribute("data-motion-state", "pending");
  const frames = await captureReveal(first);
  await testInfo.attach("service-reveal-frames", {
    body: JSON.stringify(frames),
    contentType: "application/json",
  });
  expect(frames.some(({ state }) => state === "running")).toBe(true);
  expect(
    frames[0].shapes.some(
      (_, index) =>
        new Set(frames.map((frame) => frame.shapes[index])).size > 3,
    ),
  ).toBe(true);
  await expectSettled(first);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const revisit = await captureReveal(first);
  expect(revisit.every(({ state }) => state === "settled")).toBe(true);
  await expect(first).toBeVisible();
});

test("normal-motion service and team pages retain navigation, profiles and booking", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/services/");
  await expect(
    page.locator(".detail-page-intro [data-motion=heading]"),
  ).toHaveAttribute("data-motion-state", "settled");
  await page.locator('.services-index a[href="#home-help"]').click();
  await expect(page).toHaveURL(/\/services\/#home-help$/);
  const service = page.locator("#home-help");
  await expect(
    service.getByRole("heading", { name: "Помощь на дому", exact: true }),
  ).toBeInViewport();
  await service
    .getByRole("button", { name: "Записаться на встречу", exact: true })
    .click();
  await expect(booking(page)).toBeVisible();
  await expect(
    booking(page).getByRole("radio", { name: "Помощь на дому", exact: true }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(booking(page)).not.toBeVisible();
  await page.locator('#main-navigation a[href="/team/"]').click();
  await expect(page).toHaveURL(/\/team\/$/);
  await page.getByRole("button", { name: "Эдуард Ист", exact: true }).click();
  const profile = page.getByRole("region", { name: "Эдуард Ист", exact: true });
  await expect(profile).toBeVisible();
  await profile
    .getByRole("button", { name: "Связаться с нами", exact: true })
    .click();
  await expect(booking(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(booking(page)).not.toBeVisible();
  await expect(page.locator("#site-preloader, canvas")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("keyboard focus and direct section links bypass pending reveals", async ({
  page,
}) => {
  await page.goto("/");
  const card = cards(page).last();
  await expect(card).toHaveAttribute("data-motion-state", "pending");
  await card.evaluate((element) =>
    (element as HTMLElement).focus({ preventScroll: true }),
  );
  await expectSettled(card);
  await expect(card).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Помощь на дому", exact: true }),
  ).toBeVisible();
  await page.goto("/services/#home-help");
  const linkedHeading = page.locator("#service-title-home-help");
  await expect(linkedHeading).toBeInViewport();
  await expectSettled(linkedHeading);
  await expectSettled(page.locator("#home-help .services-detail-visual"));
});

test("live system and site motion preferences settle pending and running scenes", async ({
  page,
}) => {
  for (const preference of ["system", "site"] as const) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const first = cards(page).first();
    await expect(first).toHaveAttribute("data-motion-state", "pending");
    await first.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await expect(first).toHaveAttribute("data-motion-state", "running");
    if (preference === "system") {
      await page.emulateMedia({ reducedMotion: "reduce" });
    } else {
      const panel = await openAccessibility(page);
      await panel
        .getByRole("checkbox", { name: "Меньше движения", exact: true })
        .check();
      await closeAccessibility(page);
    }
    await expect(
      page.locator(
        '[data-motion][data-motion-state="pending"], [data-motion][data-motion-state="running"]',
      ),
    ).toHaveCount(0);
    await expectSettled(first);
    await expectSettled(
      page
        .locator(".site-footer[data-motion], .site-footer [data-motion]")
        .first(),
    );
    if (preference === "system") {
      await page.emulateMedia({ reducedMotion: "no-preference" });
    } else {
      const panel = await openAccessibility(page);
      await panel
        .getByRole("checkbox", { name: "Меньше движения", exact: true })
        .uncheck();
      await closeAccessibility(page);
    }
    await expectSettled(first);
  }
});

test("without IntersectionObserver every scene remains readable and usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", { value: undefined });
  });
  await page.goto("/");
  await expect(page.locator("[data-motion]").first()).toHaveAttribute(
    "data-motion-state",
    "settled",
  );
  const hidden = await page.locator("[data-motion]").evaluateAll(
    (elements) =>
      elements.filter((element) => {
        const style = getComputedStyle(element);
        return (
          style.visibility === "hidden" ||
          Number(style.opacity) < 1 ||
          (element as HTMLElement).dataset.motionState !== "settled"
        );
      }).length,
  );
  expect(hidden).toBe(0);
  await cards(page).last().click();
  await expect(
    page.getByRole("dialog", { name: "Помощь на дому", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("normal motion fits narrow screens during home and internal-page reveals", async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/services/", "/team/"]) {
      await page.goto(path);
      const overflow = await page.evaluate(async () => {
        let maximum = 0;
        const scenes = [
          ...document.querySelectorAll<HTMLElement>("[data-motion]"),
        ];
        for (const scene of scenes) {
          scene.scrollIntoView({ block: "center", behavior: "instant" });
          // A handful of painted frames catches transformed edges, not only the
          // layout once animations have completed.
          for (let frame = 0; frame < 4; frame++) {
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            maximum = Math.max(
              maximum,
              document.documentElement.scrollWidth - innerWidth,
            );
          }
        }
        return { maximum, scenes: scenes.length };
      });
      expect(overflow.scenes).toBeGreaterThan(5);
      expect(overflow.maximum, `${width}px ${path}`).toBeLessThanOrEqual(1);
      await expect(page.locator("#site-preloader, canvas")).toHaveCount(0);
    }
  }

  // Enlarged biographies make the team gallery much taller. A perspective
  // transform must not project that offscreen content beyond the viewport.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "kodu-accessibility-v1",
      JSON.stringify({ textSize: 200, reduceMotion: false }),
    );
  });
  await page.goto("/");
  const gallery = page.locator(".team-gallery");
  await expect(gallery).toHaveAttribute("data-motion-state", "pending");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
    "320px / 200% text while the team gallery is still pending",
  ).toBeLessThanOrEqual(1);
  const galleryReveal = await gallery.evaluate(async (element) => {
    const node = element as HTMLElement;
    let maximum = 0;
    const states: string[] = [];
    const started = performance.now();
    node.scrollIntoView({ block: "center", behavior: "instant" });
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      maximum = Math.max(
        maximum,
        document.documentElement.scrollWidth - innerWidth,
      );
      states.push(node.dataset.motionState ?? "");
    } while (
      (states.length < 8 || node.dataset.motionState !== "settled") &&
      performance.now() - started < 5000
    );
    return { maximum, states };
  });
  expect(galleryReveal.states).toContain("running");
  expect(
    galleryReveal.maximum,
    "320px / 200% text during the team reveal",
  ).toBeLessThanOrEqual(1);
  await expectSettled(gallery);
});

test.describe("first visit", () => {
  test.use({ developmentNotice: "first-visit" });

  test("hero waits for the notice, then reveals the original image with depth and a curved mask", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const hero = page.locator(".hero-section");
    await expect(page.locator("dialog.development-notice")).toBeVisible();
    await expect(hero).toHaveAttribute("data-hero-motion", "waiting");
    await expect(hero.locator(".hero-image > img")).toHaveAttribute(
      "src",
      "/images/calm-home.webp",
    );
    expect(
      await hero.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);

    const frames = await hero.evaluate(async (element) => {
      const scene = element as HTMLElement;
      const picture = scene.querySelector(".hero-image > img")!;
      const notice = document.querySelector<HTMLDialogElement>(
        "dialog.development-notice",
      )!;
      const frames: {
        state?: string;
        noticeOpen: boolean;
        clip: string;
        transform: string;
      }[] = [];
      notice
        .querySelector<HTMLButtonElement>(".development-notice-continue")!
        .click();
      const started = performance.now();
      do {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        const style = getComputedStyle(picture);
        frames.push({
          state: scene.dataset.heroMotion,
          noticeOpen: notice.open,
          clip: style.clipPath,
          transform: style.transform,
        });
      } while (
        scene.dataset.heroMotion !== "ready" &&
        performance.now() - started < 5000
      );
      return frames;
    });
    await testInfo.attach("hero-opening-frames", {
      body: JSON.stringify(frames),
      contentType: "application/json",
    });
    expect(
      frames.filter(({ state }) => state === "entering").length,
    ).toBeGreaterThan(3);
    expect(
      frames
        .filter(({ state }) => state === "entering")
        .every(({ noticeOpen }) => !noticeOpen),
    ).toBe(true);
    expect(new Set(frames.map(({ clip }) => clip)).size).toBeGreaterThan(3);
    expect(
      new Set(frames.map(({ transform }) => transform)).size,
    ).toBeGreaterThan(3);
    await expect(hero).toHaveAttribute("data-hero-motion", "ready");
    await expect(page.locator("#site-preloader, canvas")).toHaveCount(0);
    await hero.locator(".hero-actions .pill-button").click();
    await expect(booking(page)).toBeVisible();
  });
});
