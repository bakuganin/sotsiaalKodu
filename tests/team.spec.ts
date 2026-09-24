import { expect, test, type Page } from "./fixtures";
import { setTextSize } from "./accessibility-helpers";

const team = (page: Page) => page.locator(".people-team");
const person = (page: Page, name: string) =>
  team(page).getByRole("button", { name, exact: true });
const panel = (page: Page, id: string) => page.locator(`#team-panel-${id}`);

test("team starts with Natalia expanded and switches the visible profile on click", async ({
  page,
}) => {
  await page.goto("/team/");
  const natalia = person(page, "Наталья Умарова");
  const eduard = person(page, "Эдуард Ист");
  await expect(natalia).toHaveAttribute("aria-controls", "team-panel-natalia");
  await expect(eduard).toHaveAttribute("aria-controls", "team-panel-eduard");
  await expect(natalia).toHaveAttribute("aria-expanded", "true");
  await expect(eduard).toHaveAttribute("aria-expanded", "false");
  await expect(panel(page, "natalia")).toBeVisible();
  await expect(panel(page, "eduard")).toBeHidden();
  await expect(
    team(page).locator('.team-card[data-active="true"]'),
  ).toHaveCount(1);

  await eduard.click();
  await expect(eduard).toHaveAttribute("aria-expanded", "true");
  await expect(natalia).toHaveAttribute("aria-expanded", "false");
  await expect(panel(page, "eduard")).toBeVisible();
  await expect(panel(page, "natalia")).toBeHidden();
  await expect(
    team(page).locator('.team-card[data-active="true"]'),
  ).toHaveCount(1);

  await natalia.click();
  await expect(natalia).toHaveAttribute("aria-expanded", "true");
  await expect(eduard).toHaveAttribute("aria-expanded", "false");
  await expect(panel(page, "natalia")).toBeVisible();
  await expect(panel(page, "eduard")).toBeHidden();
});

test("team supports Enter and excludes collapsed profile links from the keyboard order", async ({
  page,
}) => {
  await page.goto("/team/");
  const natalia = person(page, "Наталья Умарова");
  const eduard = person(page, "Эдуард Ист");
  await eduard.focus();
  await page.keyboard.press("Enter");
  await expect(eduard).toHaveAttribute("aria-expanded", "true");
  await expect(eduard).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    panel(page, "eduard").getByRole("button", { name: "Связаться с нами" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(eduard).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(natalia).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(natalia).toHaveAttribute("aria-expanded", "true");
  await expect(panel(page, "eduard")).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(
    panel(page, "natalia").getByRole("button", { name: "Связаться с нами" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(eduard).toBeFocused();
});

test("both team profiles fit 320px and 390px screens, including increased text", async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/team/");
    for (const enlarged of [false, true]) {
      if (enlarged) await setTextSize(page, "125%");
      for (const [name, id] of [
        ["Эдуард Ист", "eduard"],
        ["Наталья Умарова", "natalia"],
      ]) {
        await person(page, name).click();
        await expect(panel(page, id)).toBeVisible();
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            ),
          )
          .toBeLessThanOrEqual(1);
        const bounds = await panel(page, id).evaluate((element) => ({
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          contentWidth: element.scrollWidth,
          width: element.clientWidth,
        }));
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(width);
        expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width + 1);
      }
    }
    await setTextSize(page, "100%");
  }
});

test("team expansion interpolates without moving the gallery boundary on desktop and mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/team/?team-transition-width=${width}`);
    await page.evaluate(() => document.fonts.ready);
    await team(page).scrollIntoViewIfNeeded();

    const frames = await team(page).evaluate(async (section, mobile) => {
      const gallery = section.querySelector(".team-gallery")!;
      const card = section.querySelector(".team-eduard")!;
      const portrait = card.querySelector<HTMLButtonElement>(".team-portrait")!;
      const measure = () => ({
        size: (mobile ? portrait : card).getBoundingClientRect()[
          mobile ? "height" : "width"
        ],
        galleryHeight: gallery.getBoundingClientRect().height,
        scrollY: window.scrollY,
      });
      const samples = [measure()];
      portrait.click();
      const started = performance.now();
      do {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        samples.push(measure());
      } while (
        performance.now() - started < 120 ||
        (performance.now() - started < 1800 &&
          section
            .getAnimations({ subtree: true })
            .some((animation) => animation.playState === "running"))
      );
      return samples;
    }, width < 761);

    const first = frames[0];
    const last = frames.at(-1)!;
    expect(last.size - first.size).toBeGreaterThan(150);
    expect(
      frames.filter(
        (frame) => frame.size > first.size + 5 && frame.size < last.size - 5,
      ).length,
    ).toBeGreaterThan(2);
    expect(
      Math.max(...frames.map((frame) => frame.galleryHeight)) -
        Math.min(...frames.map((frame) => frame.galleryHeight)),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.max(...frames.map((frame) => frame.scrollY)) -
        Math.min(...frames.map((frame) => frame.scrollY)),
    ).toBeLessThanOrEqual(1);
    await expect(person(page, "Эдуард Ист")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(panel(page, "natalia")).toBeHidden();
  }
});

test("rapid team switches settle on the last selection and reduced motion switches immediately", async ({
  page,
}) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/team/?team-transition-width=${width}`);
    await page.evaluate(() => document.fonts.ready);
    const initial = await team(page).locator(".team-natalia").boundingBox();

    await team(page).evaluate(async (section) => {
      const natalia = section.querySelector<HTMLButtonElement>(
        ".team-natalia .team-portrait",
      )!;
      const eduard = section.querySelector<HTMLButtonElement>(
        ".team-eduard .team-portrait",
      )!;
      for (const button of [eduard, natalia, eduard, natalia]) {
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    });
    await expect
      .poll(() =>
        team(page).evaluate(
          (section) =>
            section
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
        ),
      )
      .toBe(0);
    await expect(person(page, "Наталья Умарова")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(panel(page, "natalia")).toBeVisible();
    await expect(panel(page, "eduard")).toBeHidden();
    const settled = await team(page).locator(".team-natalia").boundingBox();
    expect(Math.abs(settled!.width - initial!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(settled!.height - initial!.height)).toBeLessThanOrEqual(1);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const runningAnimations = await team(page).evaluate((section) => {
      section
        .querySelector<HTMLButtonElement>(".team-eduard .team-portrait")!
        .click();
      return new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          resolve(
            section
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === "running").length,
          ),
        ),
      );
    });
    expect(runningAnimations).toBe(0);
    await expect(person(page, "Эдуард Ист")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(panel(page, "natalia")).toBeHidden();
    await expect(panel(page, "eduard")).toBeVisible();
  }
});
