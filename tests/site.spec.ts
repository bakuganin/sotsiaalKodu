import { expect, test, type Page } from "./fixtures";
import {
  closeAccessibility,
  openAccessibility,
  setTextSize,
} from "./accessibility-helpers";

const bookingLabel = "Записаться на встречу";
const counselling = "Консультирование и менторство";
const bookingDialog = (page: Page) => page.locator("dialog.booking-dialog");

async function waitForSiteReady(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-site-ready", "true");
}

async function openBooking(page: Page) {
  await page
    .locator(".hero-actions")
    .getByRole("button", { name: bookingLabel })
    .click();
  await expect(bookingDialog(page)).toBeVisible();
  await expect(
    bookingDialog(page).getByText(
      "Даты и время — пример. Реальная запись пока не открыта.",
    ),
  ).toBeVisible();
}

async function selectService(page: Page, title = counselling) {
  const dialog = bookingDialog(page);
  await dialog.getByText(title, { exact: true }).click();
  await expect(
    dialog.getByRole("radio", { name: title, exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Продолжить" }).click();
}

async function selectDateAndTime(page: Page) {
  const dialog = bookingDialog(page);
  await dialog.getByRole("button", { name: /15 сентября 2026/ }).click();
  await dialog.getByText("09:30", { exact: true }).click();
  await expect(
    dialog.getByRole("radio", { name: "09:30 — пример времени", exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Продолжить" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Как с вами связаться?" }),
  ).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  // Monday in Tallinn, still Sunday in Los Angeles; fake only Date, not timers.
  await page.clock.setFixedTime(new Date("2026-09-14T00:30:00Z"));
});

test("homepage loads Russian content, the illustration and four services without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await waitForSiteReady(page);
  await expect(page).toHaveTitle(/Sotsiaal Kodu/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Рядом, когда\s*нужна\s*поддержка/,
  );
  await expect(page.locator(".services-grid > a")).toHaveCount(4);
  await expect
    .poll(() =>
      page
        .locator(".hero-image img")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await expect(
    page
      .locator("#team")
      .getByRole("button", { name: "Наталья Умарова", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#team")
      .getByRole("button", { name: "Эдуард Ист", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("service links are SPA routes and browser back closes the service", async ({
  page,
}) => {
  await page.goto("/");
  await waitForSiteReady(page);
  await page.evaluate(() => {
    (window as Window & { testDocumentMarker?: string }).testDocumentMarker =
      "original-document";
  });
  await page.locator('.services-grid a[href="#/services/home-help"]').click();
  await expect(page).toHaveURL(/#\/services\/home-help$/);
  const dialog = page.getByRole("dialog", {
    name: "Помощь на дому",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Кому подойдёт" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { testDocumentMarker?: string }).testDocumentMarker,
    ),
  ).toBe("original-document");
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL("http://127.0.0.1:5173/");
});

test("a direct service URL survives reload and preselects the requested service for booking", async ({
  page,
}) => {
  await page.goto("/#/services/support-person");
  await waitForSiteReady(page);
  const detail = page.getByRole("dialog", {
    name: "Услуги опорного лица",
    exact: true,
  });
  await expect(detail).toBeVisible();
  await page.reload();
  await waitForSiteReady(page);
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: bookingLabel }).click();
  await expect(detail).not.toBeVisible();
  await expect(bookingDialog(page)).toBeVisible();
  await expect(
    bookingDialog(page).getByRole("radio", {
      name: "Услуги опорного лица",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    bookingDialog(page).getByRole("button", { name: "Продолжить" }),
  ).toBeEnabled();
});

test("booking validates contacts and produces only a demo preview without submitting or retaining personal data", async ({
  page,
}) => {
  await page.goto("/");
  await waitForSiteReady(page);
  await openBooking(page);
  const dialog = bookingDialog(page);
  await expect(
    dialog.getByRole("button", { name: "Продолжить" }),
  ).toBeDisabled();
  await selectService(page);
  await expect(
    dialog.getByRole("button", { name: "Продолжить" }),
  ).toBeDisabled();
  await selectDateAndTime(page);

  const sentRequests: { method: string; url: string; body: string }[] = [];
  page.on("request", (request) =>
    sentRequests.push({
      method: request.method(),
      url: request.url(),
      body: request.postData() ?? "",
    }),
  );
  await dialog.getByLabel("Ваше имя", { exact: true }).fill("А");
  await dialog.getByLabel("Номер телефона", { exact: true }).fill("abc");
  await dialog.getByRole("button", { name: "Проверить запись" }).click();
  await expect(
    dialog.getByText("Укажите имя: от 2 до 80 символов."),
  ).toBeVisible();
  await expect(
    dialog.getByText(/Укажите номер телефона: от 7 до 15 цифр/),
  ).toBeVisible();
  await expect(dialog.getByLabel("Ваше имя", { exact: true })).toBeFocused();

  await dialog.getByLabel("Ваше имя", { exact: true }).fill("Тестовая Анна");
  await dialog.getByLabel("Номер телефона", { exact: true }).fill("12");
  await dialog.getByRole("button", { name: "Проверить запись" }).click();
  await expect(
    dialog.getByText("Укажите имя: от 2 до 80 символов."),
  ).not.toBeVisible();
  await expect(
    dialog.getByLabel("Номер телефона", { exact: true }),
  ).toBeFocused();
  await dialog.getByRole("radio", { name: "Email", exact: true }).check();
  await dialog
    .getByLabel("Электронная почта", { exact: true })
    .fill("invalid@");
  await dialog.getByRole("button", { name: "Проверить запись" }).click();
  await expect(
    dialog.getByText("Укажите email в формате name@example.com."),
  ).toBeVisible();
  await dialog
    .getByLabel("Электронная почта", { exact: true })
    .fill("preview-only@example.com");
  await dialog.getByRole("button", { name: "Проверить запись" }).click();

  await expect(
    dialog.getByRole("heading", { name: "Предпросмотр записи" }),
  ).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText(
    "Это пример. Заявка не отправлена и время не забронировано.",
  );
  await expect(dialog.getByText(counselling, { exact: true })).toBeVisible();
  await expect(dialog.getByText(/15 сентября 2026/)).toBeVisible();
  await expect(
    dialog.getByText("09:30 · Europe/Tallinn", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: /^Позвонить:/ }),
  ).toHaveAttribute("href", /^tel:\+372\d+$/);

  expect(
    sentRequests.filter((request) => !["GET", "HEAD"].includes(request.method)),
  ).toEqual([]);
  expect(
    sentRequests.filter((request) =>
      /preview-only|Тестовая/.test(`${request.url} ${request.body}`),
    ),
  ).toEqual([]);
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toMatch(/preview-only|Тестовая/);
  expect(Object.keys(storage.local).sort()).toEqual([
    "kodu-accessibility-v1",
    "sotsiaal-language",
  ]);
  expect(storage.session).toEqual({
    "sotsiaal-development-notice-dismissed": "1",
  });

  await dialog.getByRole("button", { name: "Закрыть предпросмотр" }).click();
  await expect(dialog).not.toBeVisible();
  await openBooking(page);
  await expect(
    dialog.getByRole("heading", { name: "С чего начнём?" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Продолжить" }),
  ).toBeDisabled();
  await selectService(page);
  await selectDateAndTime(page);
  await expect(dialog.getByLabel("Ваше имя", { exact: true })).toHaveValue("");
  await expect(
    dialog.getByLabel("Номер телефона", { exact: true }),
  ).toHaveValue("");
});

test("calendar uses Tallinn dates, excludes past and weekend dates, and limits month navigation", async ({
  page,
}) => {
  await page.goto("/");
  await waitForSiteReady(page);
  await openBooking(page);
  await selectService(page);
  const dialog = bookingDialog(page);
  await expect(
    dialog.getByRole("heading", { name: /сентябрь 2026/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Предыдущий месяц" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /14 сентября 2026/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /15 сентября 2026/ }),
  ).toBeEnabled();
  await expect(
    dialog.getByRole("button", { name: /19 сентября 2026/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /20 сентября 2026/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByText("Время по Таллину · Europe/Tallinn"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: /15 сентября 2026/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByRole("button", { name: /16 сентября 2026/ }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    dialog.getByRole("button", { name: /16 сентября 2026/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Следующий месяц" }).click();
  await expect(
    dialog.getByRole("heading", { name: /октябрь 2026/ }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Следующий месяц" }).click();
  await expect(
    dialog.getByRole("heading", { name: /ноябрь 2026/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Следующий месяц" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Предыдущий месяц" }).click();
  await dialog.getByRole("button", { name: "Предыдущий месяц" }).click();
  await expect(
    dialog.getByRole("heading", { name: /сентябрь 2026/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Предыдущий месяц" }),
  ).toBeDisabled();
});

test("booking keeps keyboard focus off the background, closes with Escape and restores its trigger", async ({
  page,
}) => {
  await page.goto("/");
  await waitForSiteReady(page);
  const trigger = page
    .locator(".hero-actions")
    .getByRole("button", { name: bookingLabel });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = bookingDialog(page);
  await expect(
    dialog.getByRole("heading", { name: "С чего начнём?" }),
  ).toBeFocused();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    // Native modal dialogs allow focus to reach browser chrome, never page content.
    expect(
      await dialog.evaluate(
        (element) =>
          element.contains(document.activeElement) || !document.hasFocus(),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("mobile menu supports a complete keyboard loop and Escape returns focus to the menu toggle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForSiteReady(page);
  const toggle = page.getByRole("button", {
    name: "Открыть меню",
    exact: true,
  });
  await toggle.focus();
  await page.keyboard.press("Enter");
  const navigation = page.getByRole("dialog", {
    name: "Основная навигация",
  });
  await expect(navigation).toBeVisible();
  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press("Tab");
    expect(
      await navigation.evaluate(
        (element) =>
          element.contains(document.activeElement) || !document.hasFocus(),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(navigation).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(() => document.body.classList.contains("menu-open")),
  ).toBe(false);
});

for (const width of [390, 320]) {
  test(`mobile navigation and booking fit ${width}px with normal and increased text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await waitForSiteReady(page);
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("button", { name: "Открыть меню", exact: true })
      .click();
    const navigation = page.getByRole("dialog", {
      name: "Основная навигация",
    });
    await expect(navigation).toBeVisible();
    await expect(
      navigation.getByRole("button", { name: "Закрыть меню", exact: true }),
    ).toBeVisible();
    await navigation.getByRole("link", { name: "О нас", exact: true }).click();
    await expect(page).toHaveURL(/#about$/);
    await expect(navigation).not.toBeVisible();
    await expectNoHorizontalOverflow(page);
    await openBooking(page);
    await selectService(page);
    const dialog = bookingDialog(page);
    const normalCalendarFont = await dialog
      .getByRole("button", { name: /15 сентября 2026/ })
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await setTextSize(page, "125%");
    await expect(page.locator("html")).toHaveClass(/large-text/);
    await expectNoHorizontalOverflow(page);
    await page.reload();
    await waitForSiteReady(page);
    const accessibility = await openAccessibility(page);
    await expect(
      accessibility.getByRole("radio", { name: "125%", exact: true }),
    ).toBeChecked();
    await closeAccessibility(page);
    await expectNoHorizontalOverflow(page);
    await page
      .getByRole("button", { name: "Открыть меню", exact: true })
      .click();
    await navigation.getByRole("button", { name: bookingLabel }).click();
    await expect(dialog).toBeVisible();
    await expect(navigation).not.toBeVisible();
    await selectService(page);
    await expect(
      dialog.getByRole("button", { name: /15 сентября 2026/ }),
    ).toBeVisible();
    const enlargedCalendarFont = await dialog
      .getByRole("button", { name: /15 сентября 2026/ })
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(enlargedCalendarFont / normalCalendarFont).toBeGreaterThan(1.1);
    const bounds = await dialog.evaluate((element) => ({
      left: element.getBoundingClientRect().left,
      right: element.getBoundingClientRect().right,
      contentWidth: element.scrollWidth,
      width: element.clientWidth,
    }));
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width + 1);
    await selectDateAndTime(page);
    await dialog.getByLabel("Ваше имя", { exact: true }).fill("Анна");
    await dialog
      .getByLabel("Номер телефона", { exact: true })
      .fill("+372 5555 0000");
    await dialog.getByRole("button", { name: "Проверить запись" }).click();
    await expect(
      dialog.getByRole("heading", { name: "Предпросмотр записи" }),
    ).toBeVisible();
    await expect(dialog.getByRole("status")).toContainText(
      "Заявка не отправлена",
    );
    await dialog.getByRole("button", { name: "Закрыть предпросмотр" }).click();
    await expectNoHorizontalOverflow(page);
  });
}
