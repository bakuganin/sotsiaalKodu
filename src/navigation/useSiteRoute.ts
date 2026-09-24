import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type LegalPageId = "company" | "privacy" | "cookies" | "terms";
export type SitePage = "home" | "services" | "team" | LegalPageId;

export function isLegalPage(page: SitePage): page is LegalPageId {
  return ["company", "privacy", "cookies", "terms"].includes(page);
}

const routePaths: Record<string, SitePage> = {
  "/": "home",
  "/services": "services",
  "/team": "team",
  "/company": "company",
  "/privacy": "privacy",
  "/cookies": "cookies",
  "/terms": "terms",
};
const routeEvent = "sotsiaal:navigate";

function entryKey(): string {
  if (typeof history.state?.sotsiaalEntry === "string")
    return history.state.sotsiaalEntry;
  const key = crypto.randomUUID();
  history.replaceState({ ...history.state, sotsiaalEntry: key }, "");
  return key;
}

function normalizedPath(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

function readLocation() {
  if (window.location.hash === "#/privacy") {
    history.replaceState(history.state, "", "/privacy/");
  }
  return {
    pathname: normalizedPath(window.location.pathname),
    hash: window.location.hash,
  };
}

function motionBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.a11yReduceMotion === "true"
    ? "instant"
    : "smooth";
}

// Keep ordinary anchors, modifier clicks and the existing service dialog URLs.
// Only the site's own page changes are handled without reloading the document.
export function useSiteRoute() {
  const [location, setLocation] = useState(readLocation);
  const previousPath = useRef<string | undefined>(undefined);
  const restoreScroll = useRef<number | undefined>(undefined);
  const scrollPositions = useRef(new Map<string, number>());
  const currentEntry = useRef("");
  const pendingPage = useRef(false);
  const page = routePaths[location.pathname] ?? "home";

  useEffect(() => {
    currentEntry.current = entryKey();
    const recordScroll = () => {
      if (!pendingPage.current)
        scrollPositions.current.set(currentEntry.current, window.scrollY);
    };
    recordScroll();
    const update = () => {
      currentEntry.current = entryKey();
      pendingPage.current =
        previousPath.current !== normalizedPath(window.location.pathname);
      setLocation(readLocation());
    };
    const onPopState = (event: PopStateEvent) => {
      restoreScroll.current =
        scrollPositions.current.get(entryKey()) ?? event.state?.sotsiaalScroll;
      update();
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const url = new URL(link.href, window.location.href);
      const path = normalizedPath(url.pathname);
      if (url.origin !== window.location.origin || !(path in routePaths))
        return;
      recordScroll();
      if (path === normalizedPath(window.location.pathname)) {
        if (url.hash) return;
        event.preventDefault();
        if (window.location.hash) {
          history.pushState({}, "", url);
          update();
        }
        document.getElementById("main")?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: motionBehavior() });
        return;
      }
      event.preventDefault();
      history.replaceState(
        { ...history.state, sotsiaalScroll: window.scrollY },
        "",
      );
      history.pushState({}, "", url);
      restoreScroll.current = undefined;
      window.dispatchEvent(new Event(routeEvent));
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", onPopState);
    window.addEventListener(routeEvent, update);
    window.addEventListener("scroll", recordScroll, { passive: true });
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(routeEvent, update);
      window.removeEventListener("scroll", recordScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (previousPath.current === location.pathname) return;
    const initial = previousPath.current === undefined;
    const savedScroll = restoreScroll.current;
    restoreScroll.current = undefined;
    const frame = requestAnimationFrame(() => {
      previousPath.current = location.pathname;
      const anchor = location.hash.slice(1);
      const target =
        anchor && !anchor.startsWith("/")
          ? document.getElementById(anchor)
          : null;
      if (!initial)
        document.getElementById("main")?.focus({ preventScroll: true });
      if (savedScroll !== undefined) {
        window.scrollTo({ top: savedScroll, behavior: "instant" });
      } else if (target) {
        target.scrollIntoView({
          behavior: initial ? "instant" : motionBehavior(),
        });
      } else if (!initial) {
        window.scrollTo({ top: 0, behavior: "instant" });
      }
      pendingPage.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [location]);

  function replaceHash(hash: string) {
    history.replaceState(
      history.state,
      "",
      `${window.location.pathname}${window.location.search}${hash}`,
    );
    setLocation(readLocation());
  }

  return { page, hash: location.hash, replaceHash };
}
