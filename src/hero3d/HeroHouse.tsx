import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { HeroSceneController } from "./createHeroScene";
import type { BlenderHouseModel } from "./loadBlenderHouse";
import "./hero-house.css";

export default function HeroHouse({ alt }: { alt: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<HeroSceneController | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">(
    "loading",
  );
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const hero = host?.closest<HTMLElement>(".hero-section");
    if (!host || !hero) return;
    const root = document.documentElement;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let disposed = false;
    let requested = false;
    let inView = true;
    let controller: HeroSceneController | undefined;
    let loadedModel: BlenderHouseModel | undefined;
    const loadAbort = new AbortController();
    let loadTimer: number | undefined;
    let failed = false;
    const isReduced = () =>
      motion.matches || root.dataset.a11yReduceMotion === "true";
    const updateActive = () =>
      controller?.setActive(
        !failed &&
          inView &&
          !document.hidden &&
          root.dataset.a11yHideImages !== "true",
      );
    const updateBackground = () => {
      const panels = hero.querySelector<HTMLElement>(".hero-panels");
      const hasPanels = panels && getComputedStyle(panels).display !== "none";
      const split = Boolean(
        hasPanels &&
        panels.firstElementChild &&
        getComputedStyle(panels.firstElementChild).display !== "none",
      );
      const paper = split
        ? panels?.firstElementChild
        : hasPanels
          ? panels
          : hero;
      const background = paper
        ? getComputedStyle(paper).backgroundColor
        : "#efefed";
      controller?.setBackground(
        background,
        getComputedStyle(hero).backgroundColor,
        split,
      );
    };
    const updatePreferences = () => {
      const value = isReduced();
      setReduced(value);
      controller?.setReducedMotion(value);
      updateBackground();
      updateActive();
    };
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      window.clearTimeout(loadTimer);
      loadAbort.abort();
      controller?.dispose();
      loadedModel?.dispose();
      loadedModel = undefined;
      controller = undefined;
      controllerRef.current = null;
      setState("fallback");
    };
    const start = async () => {
      if (disposed || requested || root.dataset.siteReady === "false") return;
      requested = true;
      // A stalled model or texture must leave the original illustration usable.
      loadTimer = window.setTimeout(fail, 12_000);
      try {
        const [{ createHeroScene }, { loadBlenderHouse }] = await Promise.all([
          import("./createHeroScene"),
          import("./loadBlenderHouse"),
        ]);
        if (disposed || failed) return;
        loadedModel = await loadBlenderHouse(loadAbort.signal);
        if (disposed || failed) {
          loadedModel.dispose();
          loadedModel = undefined;
          return;
        }
        controller = createHeroScene(
          host,
          {
            reducedMotion: isReduced(),
            onReady: () => {
              if (!disposed) setState("ready");
            },
            onError: fail,
          },
          loadedModel,
        );
        window.clearTimeout(loadTimer);
        controllerRef.current = controller;
        updatePreferences();
      } catch {
        fail();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !pointer.matches || isReduced())
        return;
      const rect = hero.getBoundingClientRect();
      controller?.point(
        ((event.clientX - rect.left) / rect.width - 0.5) * 2,
        ((event.clientY - rect.top) / rect.height - 0.5) * 2,
      );
    };
    const reset = () => controller?.reset();
    const onResize = () => {
      controller?.resize();
      updateBackground();
    };
    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(onResize)
        : undefined;
    resizeObserver?.observe(host);
    window.addEventListener("resize", onResize);
    const intersection =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            updateActive();
          })
        : undefined;
    intersection?.observe(hero);
    const preferences = new MutationObserver(() => {
      updatePreferences();
      onResize();
    });
    preferences.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-a11y-reduce-motion",
        "data-a11y-hide-images",
        "data-a11y-contrast",
        "data-a11y-text-size",
        "data-a11y-readable-font",
      ],
    });
    motion.addEventListener("change", updatePreferences);
    pointer.addEventListener("change", reset);
    hero.addEventListener("pointermove", onPointer, { passive: true });
    hero.addEventListener("pointerleave", reset);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", updateActive);
    window.addEventListener("site:ready", start, { once: true });
    updatePreferences();
    void start();

    return () => {
      disposed = true;
      window.clearTimeout(loadTimer);
      loadAbort.abort();
      resizeObserver?.disconnect();
      intersection?.disconnect();
      window.removeEventListener("resize", onResize);
      preferences.disconnect();
      motion.removeEventListener("change", updatePreferences);
      pointer.removeEventListener("change", reset);
      hero.removeEventListener("pointermove", onPointer);
      hero.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", updateActive);
      window.removeEventListener("site:ready", start);
      controller?.dispose();
      loadedModel?.dispose();
      loadedModel = undefined;
      controllerRef.current = null;
    };
  }, []);

  return (
    <div
      className="hero-image hero-house"
      data-scene-state={state}
      data-scene-motion={reduced ? "reduced" : "full"}
    >
      <img
        src="/images/calm-home.webp"
        alt={alt}
        width="1254"
        height="1254"
        fetchPriority="high"
      />
      <div className="hero-house-stage" ref={hostRef} aria-hidden="true" />
      {state === "ready" && !reduced && (
        <button
          className="hero-house-replay"
          type="button"
          onClick={() => controllerRef.current?.replay()}
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>Раскрыть заново</span>
        </button>
      )}
    </div>
  );
}
