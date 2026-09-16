// Inlined in the document head by Vite: independent of the application bundle.
(() => {
  const root = document.documentElement;
  const startedAt = performance.now();
  const MAXIMUM_MS = 8000;
  const MINIMUM_MS = 2400;
  const FADE_MS = 650;
  const REDUCED_MS = 150;
  const SEEN_KEY = "sotsiaal-preloader-seen";
  let phase = "initial";
  let loaded = document.readyState === "complete";
  let domReady = document.readyState !== "loading";
  let reduced = false;
  let minimumTimer;
  let fadeTimer;
  let timeoutFadeTimer;
  let maximumTimer;
  let motionQuery;

  const content = () => document.getElementById("root");
  const elapsed = () => performance.now() - startedAt;

  function finish(reason) {
    if (phase === "ready") return;
    phase = "ready";
    [minimumTimer, fadeTimer, timeoutFadeTimer, maximumTimer].forEach(
      clearTimeout,
    );
    window.removeEventListener("load", onLoad);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motionQuery?.removeEventListener("change", onMotionChange);
    root.dataset.loaderState = "ready";
    root.dataset.siteReady = "true";
    const app = content();
    if (app) {
      app.inert = false;
      app.removeAttribute("aria-hidden");
    }
    const overlay = document.getElementById("site-preloader");
    if (overlay) overlay.hidden = true;
    window.dispatchEvent(new CustomEvent("site:ready", { detail: { reason } }));
  }

  function leave(reason) {
    if (phase === "ready" || phase === "leaving") return;
    phase = "leaving";
    root.dataset.loaderState = "leaving";
    // The document is visible behind the fade, but remains inert until ready.
    fadeTimer = window.setTimeout(
      () => finish(reason),
      Math.max(
        0,
        Math.min(reduced ? REDUCED_MS : FADE_MS, MAXIMUM_MS - elapsed()),
      ),
    );
  }

  function checkLoaded() {
    if (phase !== "loading" || !loaded || !domReady) return;
    window.clearTimeout(minimumTimer);
    const remaining = (reduced ? REDUCED_MS : MINIMUM_MS) - elapsed();
    if (remaining <= 0) leave("loaded");
    else minimumTimer = window.setTimeout(checkLoaded, remaining);
  }

  function onLoad() {
    loaded = true;
    checkLoaded();
  }

  function onDomReady() {
    domReady = true;
    if (phase === "skipped") {
      finish("skipped");
      return;
    }
    if (phase === "ready") return;
    const app = content();
    if (app) {
      app.inert = true;
      app.setAttribute("aria-hidden", "true");
    }
    checkLoaded();
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible" && elapsed() >= MAXIMUM_MS)
      finish("timeout");
  }

  function onMotionChange() {
    reduced = motionQuery.matches || root.dataset.a11yReduceMotion === "true";
    root.dataset.loaderMotion = reduced ? "reduced" : "full";
    checkLoaded();
  }

  try {
    const override = new URLSearchParams(window.location.search).get("loader");
    let seen = false;
    let savedReduced = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Storage can be unavailable; the independent deadline still releases us.
    }
    try {
      savedReduced =
        JSON.parse(window.localStorage.getItem("kodu-accessibility-v1") || "{}")
          .reduceMotion === true;
    } catch {
      // Invalid or unavailable preferences use the operating system setting.
    }
    const show = override === "1" || (override !== "0" && !seen);
    if (show) {
      phase = "loading";
      root.dataset.siteReady = "false";
      root.dataset.loaderState = "loading";
      motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      reduced = motionQuery.matches || savedReduced;
      root.dataset.loaderMotion = reduced ? "reduced" : "full";
      // Both deadlines start before loading the React module. The fade is
      // included in the eight-second ceiling, even when window.load is stuck.
      maximumTimer = window.setTimeout(
        () => finish("timeout"),
        Math.max(0, MAXIMUM_MS - elapsed()),
      );
      timeoutFadeTimer = window.setTimeout(
        () => leave("timeout"),
        Math.max(0, MAXIMUM_MS - FADE_MS - elapsed()),
      );
      window.addEventListener("load", onLoad, { once: true });
      document.addEventListener("visibilitychange", onVisibilityChange);
      motionQuery.addEventListener("change", onMotionChange);
      try {
        window.sessionStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Loading the site never depends on storing the visit marker.
      }
    } else {
      phase = "skipped";
      root.dataset.loaderState = "ready";
      root.dataset.siteReady = "true";
    }

    if (domReady) onDomReady();
    else
      document.addEventListener("DOMContentLoaded", onDomReady, { once: true });

    // A document restored from the back/forward cache must never retain a lock.
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) finish("restored");
    });
  } catch {
    finish("error");
  }
})();
