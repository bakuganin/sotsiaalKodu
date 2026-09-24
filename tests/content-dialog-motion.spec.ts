import { expect, test, type Page } from "./fixtures";

const detail = (page: Page) => page.locator("dialog.content-dialog");
const homeHelp = '.hero-shortcut[href="#/services/home-help"]';
const homeHelpCard = '.service-card[href="#/services/home-help"]';
const support = '.service-card[href="#/services/support-person"]';

async function visit(page: Page) {
  await page.goto("/?loader=0");
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
  await page.evaluate(() => document.fonts.ready);
}

// Sample actual painted frames rather than only checking CSS declarations.
async function sampleMotion(page: Page, opening: boolean, trigger: string) {
  return page.evaluate(
    async ({ opening, trigger }) => {
      const dialog = document.querySelector<HTMLDialogElement>(
        "dialog.content-dialog",
      )!;
      const measure = () => ({
        opacity: Number(getComputedStyle(dialog).opacity),
        top: dialog.getBoundingClientRect().top,
        modal: dialog.matches(":modal"),
        locked: document.body.style.overflow === "hidden",
        title: dialog.querySelector("h2")?.textContent,
        introduction: dialog.querySelector(".detail-intro")?.textContent,
      });
      const samples = [measure()];
      document
        .querySelector<HTMLElement>(opening ? trigger : ".dialog-close")!
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
          (opening
            ? !dialog.open || samples.at(-1)!.opacity < 0.999
            : dialog.open))
      );
      return samples;
    },
    { opening, trigger },
  );
}

test("service details animate on desktop and mobile, retaining content and the scroll lock throughout exit", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await visit(page);
    const selector = width < 768 ? homeHelpCard : homeHelp;
    const trigger = page.locator(selector);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    const before = await page.evaluate(() => scrollY);
    const launcherBefore = await page.locator(".a11y-launcher").boundingBox();
    expect(launcherBefore).not.toBeNull();

    for (const opening of [true, false]) {
      const frames = await sampleMotion(page, opening, selector);
      const intermediate = frames.filter(
        ({ opacity, modal }) => modal && opacity > 0.03 && opacity < 0.97,
      );
      expect(
        intermediate.length,
        JSON.stringify({ width, opening, frames }),
      ).toBeGreaterThan(2);
      expect(intermediate.every(({ modal, locked }) => modal && locked)).toBe(
        true,
      );
      expect(new Set(intermediate.map(({ top }) => top)).size).toBeGreaterThan(
        2,
      );
      expect(
        intermediate.every(
          ({ title, introduction }) =>
            title === "Помощь на дому" && !!introduction,
        ),
      ).toBe(true);
      const last = frames.at(-1)!;
      expect(last.opacity).toBeCloseTo(opening ? 1 : 0, 2);
      expect(last.modal).toBe(opening);
      expect(last.locked).toBe(opening);
      const launcher = await page.locator(".a11y-launcher").boundingBox();
      expect(launcher).not.toBeNull();
      expect(launcher!.x).toBeCloseTo(launcherBefore!.x, 0);
      expect(launcher!.y).toBeCloseTo(launcherBefore!.y, 0);
    }

    await expect(trigger).toBeFocused();
    expect(
      Math.abs((await page.evaluate(() => scrollY)) - before),
    ).toBeLessThanOrEqual(1);
  }
});

test("Escape and backdrop clicks use the same exit transition and preserve the dialog being dismissed", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit(page);

  for (const [selector, action] of [
    [homeHelp, "escape"],
    ['.service-card[href="#/services/counselling"]', "backdrop"],
  ] as const) {
    const trigger = page.locator(selector);
    await trigger.click();
    await expect(detail(page)).toHaveCSS("opacity", "1");
    const title = await detail(page).locator("h2").textContent();
    const text = await detail(page).locator("p").first().textContent();

    if (action === "escape") await page.keyboard.press("Escape");
    else await page.mouse.click(4, 4);

    const duringExit = await detail(page).evaluate((element) => ({
      modal: element.matches(":modal"),
      locked: document.body.style.overflow === "hidden",
      visible: (element as HTMLElement).dataset.visible,
      title: element.querySelector("h2")?.textContent,
      text: element.querySelector("p")?.textContent,
    }));
    expect(duringExit).toEqual({
      modal: true,
      locked: true,
      visible: "false",
      title,
      text,
    });
    await expect(detail(page)).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
  }
});

test("both reduced-motion settings remove service entrance motion and the delayed close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const preference of ["os", "website"]) {
    await page.emulateMedia({
      reducedMotion: preference === "os" ? "reduce" : "no-preference",
    });
    await visit(page);
    await page.evaluate((reduced) => {
      localStorage.setItem(
        "kodu-accessibility-v1",
        JSON.stringify({ reduceMotion: reduced }),
      );
    }, preference === "website");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
      "data-site-ready",
      "true",
    );
    await page.locator(homeHelpCard).click();
    await expect(detail(page)).toBeVisible();
    const state = await detail(page).evaluate(async (element) => {
      const dialog = element as HTMLDialogElement;
      const animations = dialog
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length;
      dialog.querySelector<HTMLButtonElement>(".dialog-close")!.click();
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
    await expect(page.locator(homeHelpCard)).toBeFocused();
  }
});

test("service-to-booking handoff keeps the selected service and releases scrolling after booking closes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await visit(page);
  await page.locator(support).click();
  await expect(detail(page)).toHaveCSS("opacity", "1");
  await detail(page)
    .getByRole("button", { name: "Записаться на встречу", exact: true })
    .click();
  const booking = page.locator("dialog.booking-dialog");
  await expect(detail(page)).not.toBeVisible();
  await expect(booking).toHaveCSS("opacity", "1");
  await expect(
    booking.getByRole("radio", {
      name: "Услуги опорного лица",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    booking.getByRole("heading", { name: "С чего начнём?" }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  expect(await page.locator("dialog:modal").count()).toBe(1);
  await page.keyboard.press("Escape");
  await expect(booking).not.toBeVisible();
  expect(await page.locator("dialog:modal").count()).toBe(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  await expect(page.locator(support)).toBeFocused();
});

test("a new service route during exit cancels the pending close and displays the new content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await visit(page);
  await page.locator(homeHelp).click();
  await expect(detail(page)).toHaveCSS("opacity", "1");
  const state = await page.evaluate(async () => {
    const dialog =
      document.querySelector<HTMLDialogElement>(".content-dialog")!;
    dialog.querySelector<HTMLButtonElement>(".dialog-close")!.click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const duringExit = dialog.open && dialog.dataset.visible === "false";
    location.hash = "#/services/courses";
    // Wait past the original close deadline to catch stale timers/listeners.
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      duringExit,
      modal: dialog.matches(":modal"),
      locked: document.body.style.overflow === "hidden",
      opacity: Number(getComputedStyle(dialog).opacity),
      title: dialog.querySelector("h2")?.textContent,
    };
  });
  expect(state).toEqual({
    duringExit: true,
    modal: true,
    locked: true,
    opacity: 1,
    title: "Инфодни и курсы",
  });
  await page.keyboard.press("Escape");
  await expect(detail(page)).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});
