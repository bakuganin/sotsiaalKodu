import { expect, test, type Page } from "./fixtures";

test.skip(true, "Archived: the site preloader has been removed by request.");

type LoaderSnapshot = {
  state: string | undefined;
  at: number;
  rootInert: boolean | null;
  rootVisibility: string | null;
  overlayVisible: boolean;
};

type LoaderTrace = {
  states: LoaderSnapshot[];
  loadAt: number | null;
  readyEvents: LoaderSnapshot[];
};

declare global {
  interface Window {
    __preloaderTrace: LoaderTrace;
  }
}

const seenKey = "sotsiaal-preloader-seen";
const loader = (page: Page) => page.locator("#site-preloader");
const documentRoot = (page: Page) => page.locator("html");

// The site suite normally reduces motion. These tests exercise the real entrance.
test.use({ reducedMotion: "no-preference" });

async function recordLifecycle(page: Page) {
  await page.addInitScript(() => {
    const trace: LoaderTrace = {
      states: [],
      loadAt: null,
      readyEvents: [],
    };
    window.__preloaderTrace = trace;
    const snapshot = (): LoaderSnapshot => {
      const root = document.getElementById("root");
      const overlay = document.getElementById("site-preloader");
      return {
        state: document.documentElement?.dataset.loaderState,
        at: performance.now(),
        rootInert: root?.inert ?? null,
        rootVisibility: root ? getComputedStyle(root).visibility : null,
        overlayVisible: !!(
          overlay &&
          overlay.getClientRects().length &&
          getComputedStyle(overlay).visibility !== "hidden" &&
          Number(getComputedStyle(overlay).opacity) > 0
        ),
      };
    };
    const recordState = () => {
      const current = snapshot();
      if (current.state && trace.states.at(-1)?.state !== current.state) {
        trace.states.push(current);
      }
    };
    new MutationObserver(recordState).observe(document, {
      attributes: true,
      attributeFilter: ["data-loader-state"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("load", () => {
      trace.loadAt = performance.now();
    });
    window.addEventListener("site:ready", () => {
      recordState();
      trace.readyEvents.push(snapshot());
    });
    recordState();
  });
}

async function lifecycle(page: Page) {
  return page.evaluate(() => window.__preloaderTrace);
}

async function expectUsable(page: Page, timeout = 5000) {
  await expect(documentRoot(page)).toHaveAttribute("data-site-ready", "true", {
    timeout,
  });
  await expect(documentRoot(page)).toHaveAttribute(
    "data-loader-state",
    "ready",
  );
  await expect(loader(page)).not.toBeVisible();
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).overflowY,
    ),
  ).not.toBe("hidden");
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflowY),
  ).not.toBe("hidden");
  const trace = await lifecycle(page);
  expect(trace.readyEvents).toHaveLength(1);
  expect(trace.readyEvents[0]).toMatchObject({
    state: "ready",
    rootInert: false,
    overlayVisible: false,
  });
  return trace;
}

// An eager image holds window.load without preventing React or DOMContentLoaded.
async function holdWindowLoad(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__preloader_load_probe__", async (route) => {
    await held;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    });
  });
  await page.route(/\/(?:\?.*)?$/, async (route) => {
    if (route.request().resourceType() !== "document") {
      await route.fallback();
      return;
    }
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "</body>",
      '<img src="/__preloader_load_probe__" alt="" width="1" height="1" hidden loading="eager" /></body>',
    );
    await route.fulfill({ response, body });
  });
  return release;
}

test("first visit, session reload, and explicit query overrides", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordLifecycle(page);
  await page.goto("/");
  let trace = await expectUsable(page);
  expect(trace.states.map(({ state }) => state)).toEqual([
    "loading",
    "leaving",
    "ready",
  ]);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), seenKey),
  ).toBe("1");

  await page.reload();
  trace = await expectUsable(page);
  expect(trace.states.some(({ state }) => state === "loading")).toBe(false);

  for (const navigation of ["first forced visit", "forced reload"]) {
    await test.step(navigation, async () => {
      if (navigation === "first forced visit") await page.goto("/?loader=1");
      else await page.reload();
      trace = await expectUsable(page);
      expect(trace.states.some(({ state }) => state === "loading")).toBe(true);
    });
  }

  await page.evaluate((key) => sessionStorage.removeItem(key), seenKey);
  await page.goto("/?loader=0");
  trace = await expectUsable(page);
  expect(trace.states.some(({ state }) => state === "loading")).toBe(false);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), seenKey),
  ).toBe(null);
  await page.goto("/");
  trace = await expectUsable(page);
  expect(trace.states.some(({ state }) => state === "loading")).toBe(true);
});

test("fast loading keeps the full entrance and unlocks pointer and keyboard only after its fade", async ({
  page,
}) => {
  await recordLifecycle(page);
  await page.goto("/?loader=1", { waitUntil: "domcontentloaded" });
  await expect(loader(page)).toBeVisible();
  await expect(loader(page)).toHaveAttribute("role", "status");
  await expect(loader(page)).toHaveAttribute("aria-label", /\S+/);
  await expect(documentRoot(page)).toHaveAttribute("data-site-ready", "false");
  await expect(page.locator("#root")).not.toBeVisible();
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("dialog:modal")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      document.activeElement?.matches("button, a, input, select, textarea"),
    ),
  ).toBe(false);

  await expect(documentRoot(page)).toHaveAttribute(
    "data-loader-state",
    "leaving",
  );
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("#root")).toHaveJSProperty("inert", true);
  await expect(documentRoot(page)).toHaveAttribute("data-site-ready", "false");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("dialog:modal")).toHaveCount(0);
  await expect(page.locator(".a11y-launcher")).not.toBeFocused();
  const fadeFrames = await loader(page).evaluate(async (overlay) => {
    const frames: number[] = [];
    while (
      overlay.isConnected &&
      document.documentElement.dataset.siteReady !== "true"
    ) {
      frames.push(Number(getComputedStyle(overlay).opacity));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
    return frames;
  });
  expect(fadeFrames.some((opacity) => opacity > 0 && opacity < 1)).toBe(true);

  const trace = await expectUsable(page);
  const loading = trace.states.find(({ state }) => state === "loading")!;
  const leaving = trace.states.find(({ state }) => state === "leaving")!;
  const ready = trace.readyEvents[0];
  expect(trace.loadAt).not.toBeNull();
  expect(leaving.at - loading.at).toBeGreaterThanOrEqual(2350);
  expect(leaving.at).toBeGreaterThanOrEqual(trace.loadAt!);
  expect(ready.at - leaving.at).toBeGreaterThanOrEqual(600);
  expect(ready.at - leaving.at).toBeLessThan(1200);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  const accessibility = page.getByRole("button", {
    name: "Настройки доступности",
    exact: true,
  });
  await accessibility.focus();
  await expect(accessibility).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".a11y-dialog:modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".a11y-dialog")).not.toBeVisible();
  await expect(accessibility).toBeFocused();
});

test("inline loader stays painted while application code and window.load are delayed", async ({
  page,
}) => {
  await recordLifecycle(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/src/main.tsx*", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto("/?loader=1", { waitUntil: "commit" });
    await expect(loader(page)).toBeVisible();
    await expect(loader(page).locator("svg")).toBeVisible();
    await expect(page.locator("#root")).toBeEmpty();
    await expect(page.locator("#root")).toHaveCSS("visibility", "hidden");
    const cover = await loader(page).boundingBox();
    expect(cover).toMatchObject({ x: 0, y: 0 });
    expect(cover!.width).toBe(page.viewportSize()!.width);
    expect(cover!.height).toBe(page.viewportSize()!.height);
    await page.waitForFunction(() => performance.now() >= 2900);
    await expect(documentRoot(page)).toHaveAttribute(
      "data-loader-state",
      "loading",
    );
    expect((await lifecycle(page)).loadAt).toBeNull();
    expect((await lifecycle(page)).readyEvents).toHaveLength(0);
    release();
    await page.waitForLoadState("load");
    const trace = await expectUsable(page);
    expect(
      trace.states.find(({ state }) => state === "leaving")!.at,
    ).toBeGreaterThanOrEqual(trace.loadAt!);
  } finally {
    release();
  }
});

test("a direct service URL opens its modal only after loading and still supports booking", async ({
  page,
}) => {
  await recordLifecycle(page);
  const release = await holdWindowLoad(page);
  const detail = page.locator(".content-dialog");
  try {
    await page.goto("/?loader=1#/services/home-help", {
      waitUntil: "domcontentloaded",
    });
    await expect(detail).toBeAttached();
    await page.waitForTimeout(200);
    await expect(documentRoot(page)).toHaveAttribute(
      "data-loader-state",
      "loading",
    );
    await expect(detail).toHaveJSProperty("open", false);
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    release();
    await expect(documentRoot(page)).toHaveAttribute(
      "data-loader-state",
      "leaving",
    );
    await expect(detail).toHaveJSProperty("open", false);
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    await expect(documentRoot(page)).toHaveAttribute("data-site-ready", "true");
    await expect(loader(page)).not.toBeVisible();
    await expect(page.locator("#root")).toHaveJSProperty("inert", false);
    await expect(detail).toBeVisible();
    await expect(detail).toHaveJSProperty("open", true);
    await expect(
      detail.getByRole("heading", { name: "Помощь на дому", exact: true }),
    ).toBeVisible();
    await detail
      .getByRole("button", { name: "Записаться на встречу", exact: true })
      .click();
    await expect(detail).not.toBeVisible();
    const booking = page.locator(".booking-dialog");
    await expect(booking).toBeVisible();
    await expect(
      booking.getByRole("radio", { name: "Помощь на дому", exact: true }),
    ).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(booking).not.toBeVisible();
    await expectUsable(page);
  } finally {
    release();
  }
});

test("a hung load releases the page by eight seconds and cannot complete twice", async ({
  page,
}) => {
  await recordLifecycle(page);
  const release = await holdWindowLoad(page);
  try {
    await page.goto("/?loader=1", { waitUntil: "domcontentloaded" });
    await expect(documentRoot(page)).toHaveAttribute(
      "data-loader-state",
      "loading",
    );
    await page.waitForFunction(() => performance.now() >= 7100);
    await expect(documentRoot(page)).toHaveAttribute(
      "data-loader-state",
      "loading",
    );
    expect((await lifecycle(page)).loadAt).toBeNull();
    const trace = await expectUsable(page, 2000);
    const loading = trace.states.find(({ state }) => state === "loading")!;
    const leaving = trace.states.find(({ state }) => state === "leaving")!;
    expect(leaving.at - loading.at).toBeGreaterThanOrEqual(7250);
    expect(trace.readyEvents[0].at - loading.at).toBeLessThan(8500);
    expect(trace.loadAt).toBeNull();
    release();
    await page.waitForLoadState("load");
    await page.waitForTimeout(200);
    expect((await lifecycle(page)).readyEvents).toHaveLength(1);
  } finally {
    release();
  }
});

test("storage read and write failures still leave the website usable", async ({
  context,
}) => {
  for (const method of ["getItem", "setItem"] as const) {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await recordLifecycle(page);
      await page.addInitScript((method) => {
        const original = Storage.prototype[method];
        Object.defineProperty(Storage.prototype, method, {
          configurable: true,
          value(key: string, ...values: string[]) {
            // Keep this case focused on the preloader. The startup-notice
            // suite separately exercises storage being unavailable entirely.
            if (key === "sotsiaal-preloader-seen") {
              throw new DOMException("Storage is unavailable", "SecurityError");
            }
            return Reflect.apply(original, this, [key, ...values]);
          },
        });
      }, method);
      await page.goto("/");
      let trace = await expectUsable(page);
      expect(trace.states.some(({ state }) => state === "loading")).toBe(true);
      await page.reload();
      trace = await expectUsable(page);
      expect(trace.states.some(({ state }) => state === "loading")).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  }
});

test("system and saved reduced motion use the final pose but still await window.load", async ({
  context,
}) => {
  for (const preference of ["system", "saved"] as const) {
    const page = await context.newPage();
    await recordLifecycle(page);
    if (preference === "system") {
      await page.emulateMedia({ reducedMotion: "reduce" });
    } else {
      await page.addInitScript(() => {
        localStorage.setItem(
          "kodu-accessibility-v1",
          JSON.stringify({ reduceMotion: true }),
        );
      });
    }
    const release = await holdWindowLoad(page);
    try {
      await page.goto("/?loader=1", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(350);
      await expect(documentRoot(page)).toHaveAttribute(
        "data-loader-state",
        "loading",
      );
      expect((await lifecycle(page)).loadAt).toBeNull();
      expect((await lifecycle(page)).readyEvents).toHaveLength(0);
      const activeAnimations = await loader(page).evaluate(
        (overlay) =>
          overlay
            .getAnimations({ subtree: true })
            .filter(
              (animation) =>
                animation.playState === "running" &&
                animation.effect?.getComputedTiming().activeDuration !== 0,
            ).length,
      );
      expect(activeAnimations).toBe(0);
      await expect(loader(page).locator(".loader-stem-draw")).toHaveCSS(
        "stroke-dashoffset",
        "0px",
      );
      for (const leaf of await loader(page).locator(".loader-leaf").all()) {
        await expect(leaf).toHaveCSS("opacity", "1");
        await expect(leaf).toHaveCSS("transform", "none");
      }
      release();
      await page.waitForLoadState("load");
      const trace = await expectUsable(page);
      const loading = trace.states.find(({ state }) => state === "loading")!;
      const leaving = trace.states.find(({ state }) => state === "leaving")!;
      expect(leaving.at - loading.at).toBeGreaterThanOrEqual(100);
      expect(leaving.at).toBeGreaterThanOrEqual(trace.loadAt!);
      expect(trace.readyEvents[0].at - trace.loadAt!).toBeLessThan(700);
    } finally {
      release();
      await page.close();
    }
  }
});

test("artwork grows in order and remains contained from 320 to 1920 pixels", async ({
  page,
}) => {
  await recordLifecycle(page);
  const release = await holdWindowLoad(page);
  try {
    await page.goto("/?loader=1", { waitUntil: "domcontentloaded" });
    await expect(loader(page).locator("svg")).toBeVisible();
    // Seek actual CSS animations to inspect their sequence without timing races.
    const stages = await loader(page).evaluate((overlay) => {
      const artwork = overlay.querySelector("svg")!;
      const animations = artwork.getAnimations({ subtree: true });
      const frames = [];
      for (const time of [0, 750, 1050, 1400, 2300]) {
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = time;
        }
        frames.push({
          hand: getComputedStyle(artwork.querySelector(".loader-hand-wipe")!)
            .transform,
          soil: [...artwork.querySelectorAll(".loader-soil-clump")].map(
            (clump) => Number(getComputedStyle(clump).opacity),
          ),
          stem: parseFloat(
            getComputedStyle(artwork.querySelector(".loader-stem-draw")!)
              .strokeDashoffset,
          ),
          leaves: [...artwork.querySelectorAll(".loader-leaf")].map((leaf) =>
            Number(getComputedStyle(leaf).opacity),
          ),
        });
      }
      return {
        frames,
        layers: [...artwork.querySelectorAll(":scope > g")].map(
          (layer) => layer.id,
        ),
      };
    });
    expect(stages.layers).toEqual([
      "loader-hand",
      "loader-soil",
      "loader-plant",
    ]);
    expect(stages.frames[0].soil).toEqual([0, 0, 0, 0, 0]);
    expect(stages.frames[0].stem).toBe(100);
    expect(stages.frames[0].leaves).toEqual([0, 0, 0]);
    expect(stages.frames[1].hand).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expect(stages.frames[1].soil[0]).toBe(1);
    expect(stages.frames[1].stem).toBe(100);
    expect(stages.frames[2].soil).toEqual([1, 1, 1, 1, 1]);
    expect(stages.frames[2].stem).toBeGreaterThan(0);
    expect(stages.frames[2].stem).toBeLessThan(100);
    expect(stages.frames[2].leaves).toEqual([0, 0, 0]);
    expect(stages.frames[3].leaves[0]).toBeGreaterThan(0);
    expect(stages.frames[3].leaves[1]).toBeGreaterThan(0);
    expect(stages.frames[3].leaves[2]).toBe(0);
    expect(stages.frames[4].stem).toBe(0);
    expect(stages.frames[4].leaves).toEqual([1, 1, 1]);
    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await loader(page).evaluate((overlay) => {
        const svg = overlay.querySelector("svg")!;
        const bounds = svg.getBoundingClientRect();
        const cover = overlay.getBoundingClientRect();
        return {
          width: innerWidth,
          height: innerHeight,
          cover: {
            x: cover.x,
            y: cover.y,
            width: cover.width,
            height: cover.height,
          },
          artwork: {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
            width: bounds.width,
          },
          overflow: document.documentElement.scrollWidth > innerWidth,
          externalImages: svg.querySelectorAll("image, foreignObject").length,
        };
      });
      expect(geometry.cover).toEqual({ x: 0, y: 0, width, height: 900 });
      expect(geometry.artwork.left).toBeGreaterThanOrEqual(16);
      expect(geometry.artwork.right).toBeLessThanOrEqual(width - 16);
      expect(geometry.artwork.top).toBeGreaterThanOrEqual(0);
      expect(geometry.artwork.bottom).toBeLessThanOrEqual(900);
      expect(geometry.artwork.width).toBeGreaterThan(100);
      expect(geometry.overflow).toBe(false);
      expect(geometry.externalImages).toBe(0);
    }
  } finally {
    release();
  }
});

test("intro and principles entrances are preserved until the overlay has gone", async ({
  page,
}) => {
  await recordLifecycle(page);
  const release = await holdWindowLoad(page);
  const intro = page.locator(".intro-visual");
  const principles = page.locator(".principles-scene");
  try {
    await page.goto("/?loader=1#about", { waitUntil: "domcontentloaded" });
    await expect(intro).toHaveAttribute("data-reveal-ready", "true");
    await expect(principles).toHaveAttribute("data-reveal-ready", "true");
    for (const scene of [intro, principles, intro]) {
      await scene.evaluate((element) =>
        element.scrollIntoView({ block: "center", behavior: "instant" }),
      );
      await page.waitForTimeout(180);
      await expect(intro).not.toHaveAttribute("data-revealed", "true");
      await expect(principles.locator('[data-revealed="true"]')).toHaveCount(0);
    }
    release();
    await expectUsable(page);
    await expect(intro).toHaveAttribute("data-revealed", "true");
    const introFrames = await intro
      .locator(".intro-branch")
      .evaluate(async (piece) => {
        const frames: number[] = [];
        const started = performance.now();
        do {
          frames.push(Number(getComputedStyle(piece).opacity));
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
        } while (performance.now() - started < 1100);
        return frames;
      });
    expect(introFrames.some((opacity) => opacity > 0 && opacity < 1)).toBe(
      true,
    );
    await expect(principles.locator('[data-revealed="true"]')).toHaveCount(0);
    await principles.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await expect(principles.locator('[data-revealed="true"]')).toHaveCount(3);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(intro).toHaveAttribute("data-revealed", "true");
    await expect(principles.locator('[data-revealed="true"]')).toHaveCount(3);
  } finally {
    release();
  }
});
