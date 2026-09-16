import { expect, test, type Page } from "./fixtures";

const acknowledgement = "sotsiaal-development-notice-dismissed";
const notice = (page: Page) => page.locator("dialog.development-notice");
const continueButton = (page: Page) =>
  notice(page).getByRole("button", { name: "Перейти на сайт", exact: true });

test.use({ developmentNotice: "first-visit" });

async function expectNotice(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toHaveAccessibleName("Сайт ещё в разработке");
  await expect(notice(page)).toHaveCSS("opacity", "1");
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
}

async function expectDismissed(page: Page) {
  await expect(notice(page)).not.toBeVisible();
  await expect(page.locator("dialog:modal")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  expect(
    await page.evaluate(
      () => document.activeElement?.closest(".development-notice") !== null,
    ),
  ).toBe(false);
}

test("the notice appears without a preloader or waiting for window.load", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__notice_load_probe__", async (route) => {
    await held;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
    });
  });
  await page.route(/\/(?:\?.*)?$/, async (route) => {
    if (route.request().resourceType() !== "document") return route.fallback();
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "</body>",
        '<img src="/__notice_load_probe__" alt="" width="1" height="1" hidden loading="eager" /></body>',
      ),
    });
  });
  await page.addInitScript(() => {
    const trace = {
      overlap: false,
      entrance: [] as number[],
      loadAt: null as number | null,
    };
    Object.assign(window, { __noticeTrace: trace });
    window.addEventListener("load", () => {
      trace.loadAt = performance.now();
    });
    const sample = () => {
      const dialog = document.querySelector<HTMLDialogElement>(
        ".development-notice",
      );
      if (dialog?.open) {
        trace.overlap ||= document.documentElement.dataset.siteReady !== "true";
        trace.entrance.push(Number(getComputedStyle(dialog).opacity));
      }
      if (!dialog?.open || Number(getComputedStyle(dialog).opacity) < 1)
        requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  try {
    await page.goto("/?loader=1", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".hero-section")).toBeAttached();
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-ready",
      "true",
    );
    await expect(page.locator("#site-preloader")).toHaveCount(0);
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.locator("#root")).toHaveJSProperty("inert", false);
    await expectNotice(page);
    const trace = await page.evaluate(
      () =>
        (
          window as unknown as {
            __noticeTrace: {
              overlap: boolean;
              entrance: number[];
              loadAt: number | null;
            };
          }
        ).__noticeTrace,
    );
    expect(trace.overlap).toBe(false);
    expect(trace.loadAt).toBeNull();
    expect(
      trace.entrance.filter((opacity) => opacity > 0.03 && opacity < 0.97)
        .length,
    ).toBeGreaterThan(2);
    release();
    await page.waitForLoadState("load");
  } finally {
    release();
  }
});

test("acknowledgement lasts through reloads and in-app navigation but a fresh tab gets the notice", async ({
  page,
  context,
}) => {
  await page.goto("/?loader=0");
  await expectNotice(page);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), acknowledgement),
  ).toBeNull();
  await continueButton(page).click();
  await expectDismissed(page);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), acknowledgement),
  ).toBe("1");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
  await expectDismissed(page);
  await page.locator('#main-navigation a[href="/team/"]').click();
  await expect(page).toHaveURL(/\/team\//);
  await expectDismissed(page);
  const freshTab = await context.newPage();
  try {
    await freshTab.goto("/?loader=0");
    await expectNotice(freshTab);
  } finally {
    await freshTab.close();
  }
});

test("close button, Escape and backdrop all release focus and scrolling", async ({
  page,
}) => {
  for (const method of ["close", "escape", "backdrop"] as const) {
    await page.goto("/?loader=0");
    await expectNotice(page);
    await continueButton(page).focus();
    await page.keyboard.press("Tab");
    expect(
      await notice(page).evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
    if (method === "close")
      await notice(page)
        .getByRole("button", {
          name: "Закрыть предупреждение и перейти на сайт",
          exact: true,
        })
        .click();
    else if (method === "escape") await page.keyboard.press("Escape");
    else await page.mouse.click(3, 3);
    await expectDismissed(page);
    expect(
      await page.evaluate(
        (key) => sessionStorage.getItem(key),
        acknowledgement,
      ),
    ).toBe("1");
    await page.locator(".hero-actions .pill-button").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("dialog.booking-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog.booking-dialog")).not.toBeVisible();
    await page.evaluate(
      (key) => sessionStorage.removeItem(key),
      acknowledgement,
    );
  }
});

test("unavailable browser storage does not prevent acknowledgement or further navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem"]) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException("Storage is unavailable", "SecurityError");
        },
      });
    }
  });
  await page.goto("/?loader=0");
  await expectNotice(page);
  await continueButton(page).click();
  await expectDismissed(page);
  await page.locator('#main-navigation a[href="/team/"]').click();
  await expect(page).toHaveURL(/\/team\//);
  await expectDismissed(page);
  expect(errors).toEqual([]);
});

test("a direct service link queues its dialog until the notice finishes closing", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const state = { maximumOpen: 0 };
    Object.assign(window, { __noticeModalCount: state });
    new MutationObserver(() => {
      state.maximumOpen = Math.max(
        state.maximumOpen,
        document.querySelectorAll("dialog[open]").length,
      );
    }).observe(document, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });
  });
  await page.goto("/?loader=0#/services/home-help");
  await expectNotice(page);
  const service = page.getByRole("dialog", {
    name: "Помощь на дому",
    exact: true,
  });
  await expect(service).not.toBeVisible();
  await continueButton(page).click();
  await expect(notice(page)).not.toBeVisible();
  await expect(service).toBeVisible();
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __noticeModalCount: { maximumOpen: number } })
          .__noticeModalCount.maximumOpen,
    ),
  ).toBe(1);
  await page.keyboard.press("Escape");
  await expectDismissed(page);
});

test("320px and 200% text keep the entire notice usable with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "kodu-accessibility-v1",
      JSON.stringify({ textSize: 200, reduceMotion: true }),
    );
  });
  await page.goto("/?loader=0");
  await expectNotice(page);
  await page.evaluate(() => document.fonts.ready);
  const bounds = await notice(page).evaluate((dialog) => ({
    left: dialog.getBoundingClientRect().left,
    right: dialog.getBoundingClientRect().right,
    top: dialog.getBoundingClientRect().top,
    bottom: dialog.getBoundingClientRect().bottom,
    overflow: dialog.scrollWidth - dialog.clientWidth,
    textOverflow: [...dialog.querySelectorAll("h2, p, button")].some(
      (element) => element.scrollWidth > element.clientWidth + 1,
    ),
    animations: dialog
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running").length,
  }));
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(320);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(568);
  expect(bounds.overflow).toBeLessThanOrEqual(1);
  expect(bounds.textOverflow).toBe(false);
  expect(bounds.animations).toBe(0);
  await continueButton(page).scrollIntoViewIfNeeded();
  await expect(continueButton(page)).toBeInViewport();
  await continueButton(page).click();
  await expectDismissed(page);
});

test("dismissal fades out while retaining the modal lock until the final frame", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?loader=0");
  await expectNotice(page);
  const frames = await notice(page).evaluate(async (element) => {
    const dialog = element as HTMLDialogElement;
    const frames: { opacity: number; locked: boolean; open: boolean }[] = [];
    [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent === "Перейти на сайт")!
      .click();
    const started = performance.now();
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      frames.push({
        opacity: Number(getComputedStyle(dialog).opacity),
        locked: document.body.style.overflow === "hidden",
        open: dialog.open,
      });
    } while (dialog.open && performance.now() - started < 1500);
    return frames;
  });
  const fading = frames.filter(
    ({ opacity, open }) => open && opacity > 0.03 && opacity < 0.97,
  );
  expect(fading.length).toBeGreaterThan(2);
  expect(fading.every(({ locked }) => locked)).toBe(true);
  expect(frames.at(-1)?.locked).toBe(false);
  await expectDismissed(page);
});
