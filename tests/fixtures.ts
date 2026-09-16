import { test as base } from "@playwright/test";

export * from "@playwright/test";

type NoticeOptions = {
  developmentNotice: "dismissed" | "first-visit";
};

// Feature suites start after the introductory notice. Its own suite exercises
// a real first visit instead of automatically clicking through the overlay.
export const test = base.extend<NoticeOptions>({
  developmentNotice: ["dismissed", { option: true }],
  context: async ({ context, developmentNotice }, use) => {
    if (developmentNotice === "dismissed") {
      await context.addInitScript(() => {
        try {
          sessionStorage.setItem("sotsiaal-development-notice-dismissed", "1");
        } catch {
          // Storage failure scenarios provide their own fallback assertions.
        }
      });
    }
    await use(context);
  },
});
