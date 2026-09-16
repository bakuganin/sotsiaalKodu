import { useLayoutEffect, useRef, type RefObject } from "react";

/** Content is visible by default. Only an installed observer may prepare a reveal. */
export default function useSiteMotion(
  scope: RefObject<HTMLElement | null>,
  route: string,
  paused: boolean,
) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const refreshRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const container = scope.current;
    if (!container) return;
    const root = document.documentElement;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const targets = [
      ...container.querySelectorAll<HTMLElement>("[data-motion]"),
    ];
    const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    let observer: IntersectionObserver | undefined;
    let disposed = false;
    const reduced = () =>
      preference.matches || root.dataset.a11yReduceMotion === "true";

    function settle(element: HTMLElement) {
      clearTimeout(timers.get(element));
      timers.delete(element);
      element.dataset.motionState = "settled";
      observer?.unobserve(element);
    }

    function reveal(element: HTMLElement) {
      if (
        disposed ||
        element.dataset.motionState === "settled" ||
        element.dataset.motionState === "running" ||
        pausedRef.current
      )
        return;
      if (reduced()) {
        settle(element);
        return;
      }
      element.dataset.motionState = "running";
      observer?.unobserve(element);
      // A bounded fallback also releases styles when CSS animation events are unavailable.
      const delay = Math.min(
        240,
        Math.max(0, Number(element.dataset.motionDelay) || 0),
      );
      timers.set(
        element,
        setTimeout(() => settle(element), 1800 + delay),
      );
    }

    const withinView = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < window.innerHeight * 0.94;
    };

    function revealDestination() {
      const hash = window.location.hash.slice(1);
      if (!hash || hash.startsWith("/")) return;
      let destination: HTMLElement | null = null;
      try {
        destination = document.getElementById(decodeURIComponent(hash));
      } catch {
        return;
      }
      if (!destination) return;
      // Anchor navigation and keyboard focus take priority over decorative entrances.
      targets.forEach((element) => {
        if (element.contains(destination) || destination.contains(element))
          settle(element);
      });
    }

    function refresh() {
      if (disposed) return;
      if (reduced() || typeof IntersectionObserver !== "function") {
        targets.forEach(settle);
        observer?.disconnect();
        return;
      }
      if (pausedRef.current) {
        targets
          .filter((element) => element.dataset.motionState === "running")
          .forEach(settle);
        return;
      }
      observer ??= new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) reveal(entry.target as HTMLElement);
          });
        },
        { threshold: 0, rootMargin: "0px 0px -6% 0px" },
      );
      targets.forEach((element) => {
        if (
          element.dataset.motionState === "settled" ||
          element.dataset.motionState === "running"
        )
          return;
        const delay = Math.min(
          240,
          Math.max(0, Number(element.dataset.motionDelay) || 0),
        );
        element.style.setProperty("--motion-delay", `${delay}ms`);
        element.dataset.motionState = "pending";
        observer!.observe(element);
        if (withinView(element)) reveal(element);
      });
      revealDestination();
    }

    function onFocus(event: FocusEvent) {
      if (!(event.target instanceof Element)) return;
      const focused = event.target;
      targets.filter((element) => element.contains(focused)).forEach(settle);
    }
    const onAnimationEnd = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const target = event.target;
      if (
        target.matches("[data-motion]") &&
        event.animationName.startsWith("site-")
      )
        settle(target);
    };

    const settings = new MutationObserver(refresh);
    settings.observe(root, {
      attributes: true,
      attributeFilter: ["data-a11y-reduce-motion"],
    });
    preference.addEventListener("change", refresh);
    container.addEventListener("focusin", onFocus);
    container.addEventListener("animationend", onAnimationEnd);
    window.addEventListener("hashchange", revealDestination);
    refreshRef.current = refresh;
    refresh();

    return () => {
      disposed = true;
      observer?.disconnect();
      settings.disconnect();
      timers.forEach(clearTimeout);
      preference.removeEventListener("change", refresh);
      container.removeEventListener("focusin", onFocus);
      container.removeEventListener("animationend", onAnimationEnd);
      window.removeEventListener("hashchange", revealDestination);
      targets.forEach((element) => {
        delete element.dataset.motionState;
        element.style.removeProperty("--motion-delay");
      });
      refreshRef.current = null;
    };
  }, [scope, route]);

  useLayoutEffect(() => {
    refreshRef.current?.();
  }, [paused]);
}
