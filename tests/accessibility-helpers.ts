import { expect, type Page } from "@playwright/test";

export const accessibilityDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Настройки доступности", exact: true });

export async function openAccessibility(page: Page) {
  await page
    .getByRole("button", { name: "Настройки доступности", exact: true })
    .click();
  await expect(accessibilityDialog(page)).toBeVisible();
  return accessibilityDialog(page);
}

export async function closeAccessibility(page: Page) {
  await page.keyboard.press("Escape");
  await expect(accessibilityDialog(page)).not.toBeVisible();
}

export async function setTextSize(
  page: Page,
  size: "100%" | "125%" | "150%" | "200%",
) {
  const dialog = await openAccessibility(page);
  await dialog.getByRole("radio", { name: size, exact: true }).check();
  await expect(
    dialog.getByRole("radio", { name: size, exact: true }),
  ).toBeChecked();
  await closeAccessibility(page);
}
