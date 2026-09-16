import { expect, test, type Page } from "./fixtures";
import sharp from "sharp";
import {
  closeAccessibility,
  openAccessibility,
  setTextSize,
} from "./accessibility-helpers";

test.skip(
  true,
  "3D hero is intentionally disabled: the original static house image is restored until animation work resumes.",
);

// Material compilation and CPU rendering take longer than ordinary page tests.
test.describe.configure({ timeout: 45_000 });

// Software WebGL makes this file exercise a real renderer in headless Chromium.
// Keep these flags local so existing page tests retain their normal browser.
test.use({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "no-preference",
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

const scene = (page: Page) => page.locator(".hero-image");
const canvas = (page: Page) => scene(page).locator("canvas");
const booking = (page: Page) => page.locator("dialog.booking-dialog");
const restPoses = new WeakMap<Page, { yaw: number; pitch: number }>();

async function visit(page: Page, path = "/?loader=0") {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
  await page.evaluate(() => document.fonts.ready);
}

async function ready(page: Page) {
  await expect(scene(page)).toHaveAttribute("data-scene-state", "ready", {
    timeout: 15_000,
  });
  await expect(canvas(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute("aria-hidden", "true");
  await expect(scene(page)).toHaveAttribute("data-scene-revealed", "true");
  await expectCanvasBounds(page);
  restPoses.set(page, await angles(page));
}

async function expectCanvasBounds(page: Page) {
  await expect
    .poll(() =>
      scene(page).evaluate((element) => {
        const wrapper = element.getBoundingClientRect();
        const painted = element
          .querySelector("canvas")!
          .getBoundingClientRect();
        return Math.max(
          Math.abs(wrapper.x - painted.x),
          Math.abs(wrapper.y - painted.y),
          Math.abs(wrapper.width - painted.width),
          Math.abs(wrapper.height - painted.height),
        );
      }),
    )
    .toBeLessThanOrEqual(1);
}

async function angles(page: Page) {
  return scene(page).evaluate((element) => ({
    yaw: Number((element as HTMLElement).dataset.sceneYaw),
    pitch: Number((element as HTMLElement).dataset.scenePitch),
  }));
}

async function rest(page: Page) {
  const baseline = restPoses.get(page)!;
  await expect
    .poll(async () => {
      const pose = await angles(page);
      return (
        Math.abs(pose.yaw - baseline.yaw) +
        Math.abs(pose.pitch - baseline.pitch)
      );
    })
    .toBeLessThan(0.002);
}

async function pointAtScene(page: Page) {
  const bounds = await scene(page).boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.85,
    bounds!.y + bounds!.height * 0.2,
  );
}

async function expectStaticAfterPointer(page: Page) {
  await rest(page);
  await pointAtScene(page);
  const samples = await scene(page).evaluate(async (element) => {
    const poses: { yaw: number; pitch: number }[] = [];
    const started = performance.now();
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const data = (element as HTMLElement).dataset;
      poses.push({
        yaw: Number(data.sceneYaw),
        pitch: Number(data.scenePitch),
      });
    } while (performance.now() - started < 400);
    return poses;
  });
  expect(samples.length).toBeGreaterThan(1);
  const baseline = restPoses.get(page)!;
  expect(
    samples.every(
      (pose) =>
        Math.abs(pose.yaw - baseline.yaw) +
          Math.abs(pose.pitch - baseline.pitch) <
        0.002,
    ),
  ).toBe(true);
}

async function checkBooking(page: Page) {
  const trigger = page
    .locator(".hero-actions")
    .getByRole("button", { name: "Записаться на встречу", exact: true });
  await trigger.click();
  await expect(booking(page)).toBeVisible();
  await expect(
    booking(page).getByRole("heading", { name: "С чего начнём?" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(booking(page)).not.toBeVisible();
  await expect(trigger).toBeFocused();
}

test("WebGL initialization waits until the preloader releases the page", async ({
  page,
}) => {
  // Hold the existing eager fallback image so a cold module load cannot race
  // the preloader's minimum duration before the assertion reaches the scene.
  let releaseImage!: () => void;
  const heldImage = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route("**/images/calm-home.webp", async (route) => {
    await heldImage;
    await route.continue();
  });
  await page.addInitScript(() => {
    const lifecycle: boolean[] = [];
    (window as Window & { heroContextReady?: boolean[] }).heroContextReady =
      lifecycle;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (/webgl/i.test(args[0])) {
        lifecycle.push(document.documentElement.dataset.siteReady === "true");
      }
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  try {
    await page.goto("/?loader=1", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-ready",
      "false",
    );
    await expect(scene(page)).toHaveAttribute("data-scene-state", "loading");
    expect(
      await page.evaluate(
        () =>
          (window as Window & { heroContextReady?: boolean[] })
            .heroContextReady,
      ),
    ).toEqual([]);
  } finally {
    releaseImage();
  }
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
  await ready(page);
  const contexts = await page.evaluate(
    () =>
      (window as Window & { heroContextReady?: boolean[] }).heroContextReady!,
  );
  expect(contexts.length).toBeGreaterThan(0);
  expect(contexts.every(Boolean)).toBe(true);
});

test("desktop paints a real scene, follows the pointer, returns on leave, and permits native scrolling", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await visit(page);
  await ready(page);
  await rest(page);
  const baseline = restPoses.get(page)!;
  const before = await canvas(page).screenshot();
  const statistics = await sharp(before).removeAlpha().stats();
  expect(
    Math.max(...statistics.channels.map((channel) => channel.stdev)),
  ).toBeGreaterThan(10);
  await pointAtScene(page);
  await expect
    .poll(async () => {
      const pose = await angles(page);
      return (
        Math.abs(pose.yaw - baseline.yaw) +
        Math.abs(pose.pitch - baseline.pitch)
      );
    })
    .toBeGreaterThan(0.025);
  const moved = await canvas(page).screenshot();
  expect(moved.equals(before)).toBe(false);
  await testInfo.attach("hero-desktop", {
    body: moved,
    contentType: "image/png",
  });
  await page.mouse.move(0, 0);
  await rest(page);

  await pointAtScene(page);
  const startScroll = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 420);
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeGreaterThan(startScroll + 100);
  expect(errors).toEqual([]);
});

test.describe("320px touch viewport", () => {
  test.use({
    viewport: { width: 320, height: 900 },
    hasTouch: true,
    isMobile: true,
  });

  test("renders without overflow and leaves touch scrolling, booking, and navigation usable", async ({
    page,
  }, testInfo) => {
    await visit(page);
    await ready(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      )
      .toBeLessThanOrEqual(1);
    const bounds = await scene(page).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(320);
    expect(
      await canvas(page).evaluate((element) => element.tabIndex),
    ).toBeLessThan(0);
    await testInfo.attach("hero-mobile", {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    // Browser-level touch events exercise the native scroll gesture recognizer.
    const client = await page.context().newCDPSession(page);
    const x = Math.round(bounds!.x + bounds!.width / 2);
    const y = Math.round(Math.min(780, bounds!.y + bounds!.height * 0.8));
    const startScroll = await page.evaluate(() => scrollY);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 10; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - step * 22 }],
      });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThan(startScroll + 80);
    await client.detach();
    await rest(page);
    await checkBooking(page);
    await page
      .getByRole("button", { name: "Открыть меню", exact: true })
      .click();
    const navigation = page.locator("#mobile-navigation");
    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: /О нас/ }).click();
    await expect(navigation).not.toBeVisible();
    await expect(page).toHaveURL(/#about$/);
  });
});

test("unavailable WebGL keeps the image and page controls working without an uncaught error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      if (/webgl/i.test(args[0])) return null;
      return Reflect.apply(original, this, args);
    } as typeof original;
  });
  await visit(page);
  await expect(scene(page)).toHaveAttribute("data-scene-state", "fallback");
  const fallback = scene(page).locator('img[src="/images/calm-home.webp"]');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveCSS("opacity", "1");
  expect(
    await fallback.evaluate(
      (element: HTMLImageElement) =>
        element.complete && element.naturalWidth > 0,
    ),
  ).toBe(true);
  await checkBooking(page);
  expect(errors).toEqual([]);
});

test("OS reduced motion starts static and updates a running scene", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await visit(page);
  await ready(page);
  await expect(scene(page)).toHaveAttribute("data-scene-motion", "reduced");
  await expectStaticAfterPointer(page);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(scene(page)).toHaveAttribute("data-scene-motion", "full");
  await page.mouse.move(0, 0);
  await pointAtScene(page);
  await expect
    .poll(async () =>
      Math.abs((await angles(page)).yaw - restPoses.get(page)!.yaw),
    )
    .toBeGreaterThan(0.01);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene(page)).toHaveAttribute("data-scene-motion", "reduced");
  await expectStaticAfterPointer(page);
});

test("Blender glass shader compilation failure restores the original image and keeps booking usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const state = { injected: 0 };
    (
      window as Window & { blenderShaderFailure?: { injected: number } }
    ).blenderShaderFailure = state;
    const original = WebGL2RenderingContext.prototype.shaderSource;
    WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
      const isGlassFragment =
        this.getShaderParameter(shader, this.SHADER_TYPE) ===
          this.FRAGMENT_SHADER &&
        /^\s*#define\s+USE_TRANSMISSION\s*$/m.test(source);
      if (isGlassFragment) {
        state.injected++;
        source += "\n#error FORCED_BLENDER_GLASS_COMPILATION_FAILURE\n";
      }
      original.call(this, shader, source);
    };
  });
  await visit(page);
  // Confirm injection reached the GLTF glass transmission fragment shader.
  // An unrelated initialization error must not make this check pass.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as Window & { blenderShaderFailure?: { injected: number } })
              .blenderShaderFailure!.injected,
        ),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  await expect(scene(page)).toHaveAttribute("data-scene-state", "fallback");
  await expect(canvas(page)).toHaveCount(0);
  const original = scene(page).locator('img[src="/images/calm-home.webp"]');
  await expect(original).toBeVisible();
  await expect(original).toHaveCSS("opacity", "1");
  expect(
    await original.evaluate(
      (element: HTMLImageElement) =>
        element.complete && element.naturalWidth > 0,
    ),
  ).toBe(true);
  await checkBooking(page);
  expect(errors).toEqual([]);
});

for (const failure of ["missing", "corrupt"] as const) {
  test(`${failure} Blender GLB restores the image before allocating WebGL and leaves booking usable`, async ({
    page,
  }) => {
    const errors: string[] = [];
    let intercepted = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const state = { allocated: 0 };
      (
        window as Window & { failedModelGraphics?: { allocated: number } }
      ).failedModelGraphics = state;
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        ...args: Parameters<typeof original>
      ) {
        if (/webgl/i.test(args[0])) state.allocated++;
        return Reflect.apply(original, this, args);
      } as typeof original;
    });
    await page.route("**/models/calm-home.glb", async (route) => {
      intercepted++;
      await route.fulfill({
        status: failure === "missing" ? 404 : 200,
        contentType: "model/gltf-binary",
        body:
          failure === "missing"
            ? ""
            : "Invalid binary model data for the corruption test",
      });
    });
    await visit(page);
    await expect(scene(page)).toHaveAttribute("data-scene-state", "fallback");
    expect(intercepted).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () =>
          (window as Window & { failedModelGraphics?: { allocated: number } })
            .failedModelGraphics!.allocated,
      ),
    ).toBe(0);
    await expect(canvas(page)).toHaveCount(0);
    const fallback = scene(page).locator('img[src="/images/calm-home.webp"]');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveCSS("opacity", "1");
    expect(
      await fallback.evaluate(
        (element: HTMLImageElement) =>
          element.complete && element.naturalWidth > 0,
      ),
    ).toBe(true);
    await checkBooking(page);
    expect(errors).toEqual([]);
  });
}

test("losing a live WebGL context restores the fallback and stops scene updates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await visit(page);
  await ready(page);
  const before = await angles(page);
  const contextLost = await canvas(page).evaluate(
    (element: HTMLCanvasElement) => {
      const extension = element
        .getContext("webgl2")
        ?.getExtension("WEBGL_lose_context");
      if (!extension) return false;
      extension.loseContext();
      return true;
    },
  );
  expect(contextLost).toBe(true);
  await expect(scene(page)).toHaveAttribute("data-scene-state", "fallback");
  await expect(canvas(page)).toHaveCount(0);
  await expect(scene(page).locator("img")).toHaveCSS("opacity", "1");
  await pointAtScene(page);
  await checkBooking(page);
  expect(await angles(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test("the site's reduced motion setting stops tracking and persists on reload", async ({
  page,
}) => {
  await visit(page);
  await ready(page);
  const dialog = await openAccessibility(page);
  await dialog
    .getByRole("checkbox", { name: "Меньше движения", exact: true })
    .check();
  await closeAccessibility(page);
  await expect(scene(page)).toHaveAttribute("data-scene-motion", "reduced");
  await expectStaticAfterPointer(page);
  await page.reload();
  await ready(page);
  await expect(scene(page)).toHaveAttribute("data-scene-motion", "reduced");
  await expectStaticAfterPointer(page);
});

test("canvas stays inside its image box with 200% text on desktop and mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await visit(page);
  await ready(page);
  await setTextSize(page, "200%");
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectCanvasBounds(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      )
      .toBeLessThanOrEqual(1);
    await checkBooking(page);
  }
});

test("missing intersection and resize observers preserve rendering and window resizing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", { value: undefined });
    Object.defineProperty(window, "ResizeObserver", { value: undefined });
  });
  await visit(page);
  await ready(page);
  const originalWidth = await canvas(page).evaluate(
    (element: HTMLCanvasElement) => element.width,
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await expectCanvasBounds(page);
  await expect
    .poll(() =>
      canvas(page).evaluate((element: HTMLCanvasElement) => element.width),
    )
    .not.toBe(originalWidth);
  await checkBooking(page);
  expect(errors).toEqual([]);
});

test("a failure after WebGL allocation removes the canvas and releases its context", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const contexts: WebGL2RenderingContext[] = [];
    (
      window as Window & { allocatedHeroContexts?: WebGL2RenderingContext[] }
    ).allocatedHeroContexts = contexts;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      ...args: Parameters<typeof original>
    ) {
      // The scene builds its 2D shadow after creating the renderer and model.
      if (args[0] === "2d") return null;
      const result = Reflect.apply(original, this, args);
      if (args[0] === "webgl2" && result)
        contexts.push(result as WebGL2RenderingContext);
      return result;
    } as typeof original;
  });
  await visit(page);
  await expect(scene(page)).toHaveAttribute("data-scene-state", "fallback");
  await expect(canvas(page)).toHaveCount(0);
  await expect(scene(page).locator("img")).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const contexts = (
          window as Window & {
            allocatedHeroContexts?: WebGL2RenderingContext[];
          }
        ).allocatedHeroContexts!;
        return (
          contexts.length > 0 &&
          contexts.every((context) => context.isContextLost())
        );
      }),
    )
    .toBe(true);
  await checkBooking(page);
  expect(errors).toEqual([]);
});

test("an opening paused offscreen resumes its remaining animation", async ({
  page,
}) => {
  await visit(page);
  await ready(page);
  // Click and move offscreen within one task so the reveal cannot finish
  // between separate browser automation round trips.
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".hero-house-replay")!.click();
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "instant",
    });
  });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await page.waitForTimeout(1800);
  const resumed = await scene(page).evaluate(async (element) => {
    const states: string[] = [];
    window.scrollTo({ top: 0, behavior: "instant" });
    const started = performance.now();
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      states.push((element as HTMLElement).dataset.sceneRevealed!);
    } while (performance.now() - started < 350);
    return states;
  });
  expect(resumed).toContain("false");
  expect(resumed.at(-1)).toBe("false");
  await expect(scene(page)).toHaveAttribute("data-scene-revealed", "true");
});
