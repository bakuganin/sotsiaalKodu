import { expect, test, type Page } from "./fixtures";

const panel = (page: Page) => page.locator(".a11y-dialog");
const launcher = (page: Page) => page.locator(".a11y-launcher");

async function sampleTransition(
  page: Page,
  action: "open" | "close" | "escape" | "backdrop",
) {
  return page.evaluate(async (action) => {
    const dialog = document.querySelector<HTMLDialogElement>(".a11y-dialog")!;
    const measure = () => {
      const style = getComputedStyle(dialog);
      return {
        opacity: Number(style.opacity),
        backdrop: Number(getComputedStyle(dialog, "::backdrop").opacity),
        top: dialog.getBoundingClientRect().top,
        modal: dialog.matches(":modal"),
        locked:
          getComputedStyle(document.documentElement).overflowY === "hidden",
        title: dialog.querySelector("h2")?.textContent,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    };
    if (action === "open")
      document.querySelector<HTMLButtonElement>(".a11y-launcher")!.click();
    else if (action === "close")
      dialog.querySelector<HTMLButtonElement>(".a11y-close")!.click();
    else if (action === "escape")
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    else
      dialog.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: innerWidth - 2,
          clientY: 2,
        }),
      );
    const frames = [measure()];
    const start = performance.now();
    do {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      frames.push(measure());
    } while (
      performance.now() - start < 500 ||
      (dialog.open && action !== "open" && performance.now() - start < 1000)
    );
    return frames;
  }, action);
}

test("the accessibility panel paints a soft entrance and exit on desktop and mobile without releasing the modal early", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await launcher(page).focus();
    const before = await page.evaluate(() => scrollY);
    for (const action of ["open", "close"] as const) {
      const frames = await sampleTransition(page, action);
      const intermediate = frames.filter(
        ({ opacity, modal }) => modal && opacity > 0.03 && opacity < 0.97,
      );
      expect(
        intermediate.length,
        JSON.stringify({ width, action, frames }),
      ).toBeGreaterThan(2);
      expect(new Set(intermediate.map(({ top }) => top)).size).toBeGreaterThan(
        2,
      );
      expect(
        intermediate.every(
          ({ locked, title, overflow }) =>
            locked && title === "Настройки доступности" && overflow <= 1,
        ),
      ).toBe(true);
      expect(
        frames.some(({ backdrop }) => backdrop > 0.03 && backdrop < 0.97),
      ).toBe(true);
      expect(frames.at(-1)!.modal).toBe(action === "open");
      expect(frames.at(-1)!.opacity).toBe(action === "open" ? 1 : 0);
      expect(frames.at(-1)!.locked).toBe(action === "open");
      if (action === "open") expect(frames[0].opacity).toBe(0);
    }
    await expect(launcher(page)).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(before);
  }
});

test("Escape and backdrop keep the panel in the top layer until the exit completes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  for (const action of ["escape", "backdrop"] as const) {
    await launcher(page).click();
    await expect(panel(page)).toHaveCSS("opacity", "1");
    const frames = await sampleTransition(page, action);
    expect(frames[0].modal).toBe(true);
    expect(
      frames.filter(
        ({ opacity, modal }) => modal && opacity > 0.03 && opacity < 0.97,
      ).length,
    ).toBeGreaterThan(2);
    expect(frames.at(-1)!.modal).toBe(false);
    await expect(launcher(page)).toBeFocused();
  }
});

test("both reduced-motion settings make opening static and closing immediate, including a live change during exit", async ({
  page,
}) => {
  for (const mode of ["os", "website"] as const) {
    await page.emulateMedia({
      reducedMotion: mode === "os" ? "reduce" : "no-preference",
    });
    await page.goto("/");
    if (mode === "website") {
      await page.evaluate(() =>
        localStorage.setItem(
          "kodu-accessibility-v1",
          JSON.stringify({ reduceMotion: true }),
        ),
      );
      await page.reload();
    }
    await launcher(page).click();
    await expect(panel(page)).toHaveCSS("opacity", "1");
    const result = await panel(page).evaluate(async (element) => {
      const dialog = element as HTMLDialogElement;
      const animations = dialog
        .getAnimations({ subtree: true })
        .filter(({ playState }) => playState === "running").length;
      dialog.querySelector<HTMLButtonElement>(".a11y-close")!.click();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      return { animations, open: dialog.open };
    });
    expect(result).toEqual({ animations: 0, open: false });
  }
  await page.evaluate(() => localStorage.removeItem("kodu-accessibility-v1"));
  await page.reload();
  await launcher(page).click();
  await expect(panel(page)).toHaveCSS("opacity", "1");
  await panel(page).evaluate((dialog) =>
    dialog.querySelector<HTMLButtonElement>(".a11y-close")!.click(),
  );
  await expect(panel(page)).toHaveAttribute("open", "");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(panel(page)).not.toHaveAttribute("open");
  await expect(launcher(page)).toBeFocused();
});

test("interrupted entrances and reopened exits have no stale close, and a removed source modal releases the nested panel", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.evaluate(async () => {
    const trigger =
      document.querySelector<HTMLButtonElement>(".a11y-launcher")!;
    trigger.click();
    document.querySelector<HTMLButtonElement>(".a11y-close")!.click();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    trigger.click();
  });
  await expect(panel(page)).toHaveCSS("opacity", "1");
  const reopened = await page.evaluate(async () => {
    const dialog = document.querySelector<HTMLDialogElement>(".a11y-dialog")!;
    dialog.querySelector<HTMLButtonElement>(".a11y-close")!.click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    document.querySelector<HTMLButtonElement>(".a11y-launcher")!.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {
      modal: dialog.matches(":modal"),
      opacity: Number(getComputedStyle(dialog).opacity),
    };
  });
  expect(reopened).toEqual({ modal: true, opacity: 1 });
  await page.keyboard.press("Escape");
  await expect(panel(page)).not.toBeVisible();
  await page.locator(".hero-actions button").click();
  const booking = page.locator(".booking-dialog");
  await expect(booking).toHaveCSS("opacity", "1");
  await expect(booking.locator(".a11y-launcher")).toHaveCount(1);
  await launcher(page).click();
  await expect(panel(page)).toHaveCSS("opacity", "1");
  await booking.evaluate((element) => (element as HTMLDialogElement).close());
  await expect(panel(page)).not.toBeVisible();
  await expect(page.locator("body > .a11y-launcher")).toBeFocused();
});

test("opening accessibility from mobile navigation keeps settings open after navigation dismisses", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  const menu = page.locator(".sk-mobile-menu");
  await expect(menu).toHaveCSS("opacity", "1");
  await menu.locator(".a11y-launcher").click();
  await expect(menu).not.toBeVisible();
  await expect(panel(page)).toHaveCSS("opacity", "1");
  // Pass both dialogs' exit deadlines to catch a stale source-modal close.
  await page.waitForTimeout(650);
  await expect(panel(page)).toHaveAttribute("open", "");
  await expect(page.locator("dialog:modal")).toHaveCount(1);
  await expect(panel(page).locator(".a11y-close")).toBeFocused();
  await panel(page).getByRole("radio", { name: "125%", exact: true }).check();
  await expect(
    panel(page).getByRole("radio", { name: "125%", exact: true }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(panel(page)).not.toBeVisible();
  await expect(page.locator("body > .a11y-launcher")).toBeFocused();
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).overflowY,
    ),
  ).not.toBe("hidden");
});
