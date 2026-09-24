import { expect, test, type Page } from "./fixtures";

const booking = (page: Page) => page.locator("dialog.booking-dialog");
const heroTrigger = ".hero-actions .pill-button";

async function waitForSiteReady(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-14T00:30:00Z"));
});

test("contact actions open the same form in place on desktop and mobile", async ({
  page,
}) => {
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, selectors] of [
      [
        "/",
        [
          ".contact-bottom .pill-light",
          ".contact-email",
          ".process-start",
          ".meadow-action",
        ],
      ],
      [
        "/team/",
        [
          ".team-natalia .team-contact-link",
          ".team-eduard .team-contact-link",
          ".detail-contact-actions .detail-text-link",
        ],
      ],
      ["/services/", [".detail-contact-actions .detail-text-link"]],
    ] as const) {
      await page.goto(path);
      await waitForSiteReady(page);
      await page.evaluate(() => document.fonts.ready);
      for (const selector of selectors) {
        if (path === "/team/" && selector.includes(".team-contact-link")) {
          await page
            .locator(selector.replace(".team-contact-link", ".team-portrait"))
            .click();
        }
        const trigger = page.locator(selector);
        await trigger.scrollIntoViewIfNeeded();
        await trigger.focus();
        const before = await page.evaluate(() => ({
          url: location.href,
          scrollY,
        }));
        await trigger.click();
        const dialog = booking(page);
        await expect(dialog).toBeVisible();
        await expect(page).toHaveURL(before.url);
        await expect(
          dialog.getByRole("heading", { name: "С чего начнём?" }),
        ).toBeFocused();
        await expect(
          dialog.locator('input[name="booking-service"]:checked'),
        ).toHaveCount(0);
        await expect
          .poll(() =>
            dialog.evaluate(
              (element) => element.scrollWidth - element.clientWidth,
            ),
          )
          .toBeLessThanOrEqual(1);
        await dialog.getByRole("button", { name: "Закрыть запись" }).click();
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await expect(page).toHaveURL(before.url);
        expect(
          Math.abs((await page.evaluate(() => scrollY)) - before.scrollY),
        ).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("the form fades in and out while the background remains locked until it closes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await waitForSiteReady(page);
    await page.evaluate(() => document.fonts.ready);
    const trigger = page.locator(heroTrigger);
    await trigger.focus();

    for (const opening of [true, false]) {
      const frames = await page.evaluate(
        async ({ opening, heroTrigger }) => {
          const dialog =
            document.querySelector<HTMLDialogElement>(".booking-dialog")!;
          const measure = () => ({
            opacity: Number(getComputedStyle(dialog).opacity),
            modal: dialog.matches(":modal"),
            locked: document.body.style.overflow === "hidden",
          });
          const samples = [measure()];
          document
            .querySelector<HTMLButtonElement>(
              opening ? heroTrigger : ".booking-close",
            )!
            .click();
          const started = performance.now();
          do {
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            samples.push(measure());
          } while (
            performance.now() - started < 80 ||
            (performance.now() - started < 1200 &&
              (opening ? samples.at(-1)!.opacity < 0.999 : dialog.open))
          );
          return samples;
        },
        { opening, heroTrigger },
      );
      const intermediate = frames.filter(
        ({ opacity }) => opacity > 0.03 && opacity < 0.97,
      );
      expect(
        intermediate.length,
        JSON.stringify({ width, opening, frames }),
      ).toBeGreaterThan(2);
      expect(intermediate.every(({ modal, locked }) => modal && locked)).toBe(
        true,
      );
      const last = frames.at(-1)!;
      expect(last.opacity).toBeCloseTo(opening ? 1 : 0, 2);
      expect(last.modal).toBe(opening);
      expect(last.locked).toBe(opening);
    }
    await expect(trigger).toBeFocused();
  }
});

test("OS and website reduced-motion settings remove the form transition and close delay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const preference of ["os", "website"]) {
    await page.emulateMedia({
      reducedMotion: preference === "os" ? "reduce" : "no-preference",
    });
    await page.goto("/");
    await waitForSiteReady(page);
    await page.evaluate((reduced) => {
      localStorage.setItem(
        "kodu-accessibility-v1",
        JSON.stringify({ reduceMotion: reduced }),
      );
    }, preference === "website");
    await page.reload();
    await waitForSiteReady(page);
    await page.locator(heroTrigger).click();
    await expect(booking(page)).toBeVisible();
    const state = await booking(page).evaluate(async (element) => {
      const dialog = element as HTMLDialogElement;
      const animations = dialog
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length;
      dialog.querySelector<HTMLButtonElement>(".booking-close")!.click();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      return {
        animations,
        open: dialog.open,
        locked: document.body.style.overflow === "hidden",
      };
    });
    expect(state).toEqual({ animations: 0, open: false, locked: false });
    await expect(page.locator(heroTrigger)).toBeFocused();
  }
});

test("reopening during the exit cancels the pending close and Escape releases the form", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await waitForSiteReady(page);
  await page.locator(heroTrigger).click();
  await expect(booking(page)).toHaveCSS("opacity", "1");
  await page.evaluate(async (selector) => {
    document.querySelector<HTMLButtonElement>(".booking-close")!.click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    // Exercise a new controlled open request before the previous exit finishes.
    document.querySelector<HTMLButtonElement>(selector)!.click();
  }, heroTrigger);
  await expect(booking(page)).toHaveCSS("opacity", "1");
  expect(
    await booking(page).evaluate((element) => element.matches(":modal")),
  ).toBe(true);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  await page.keyboard.press("Escape");
  await expect(booking(page)).not.toBeVisible();
  await expect(page.locator(heroTrigger)).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});
