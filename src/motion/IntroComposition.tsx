import { useLayoutEffect, useRef, type PropsWithChildren } from "react";
import "./intro-composition.css";

export default function IntroComposition({
  children,
  paused,
}: PropsWithChildren<{ paused: boolean }>) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const refreshRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const root = document.documentElement;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let observer: IntersectionObserver | undefined;
    let decodeTimeout: ReturnType<typeof setTimeout> | undefined;
    let requested = false;
    let imagesReady = false;
    let disposed = false;

    const reveal = () => {
      observer?.disconnect();
      observer = undefined;
      scene.dataset.revealed = "true";
    };

    const prepareImagesAndReveal = async () => {
      if (
        disposed ||
        pausedRef.current ||
        root.dataset.siteReady === "false" ||
        requested ||
        scene.dataset.revealed === "true"
      )
        return;
      requested = true;
      observer?.disconnect();

      // Decode before revealing, but a stalled image must never hide the scene.
      const images = Array.from(scene.querySelectorAll("img"));
      images.forEach((image) => {
        image.loading = "eager";
      });
      await Promise.race([
        Promise.allSettled(images.map((image) => image.decode())),
        new Promise<void>((resolve) => {
          decodeTimeout = setTimeout(resolve, 1200);
        }),
      ]);
      clearTimeout(decodeTimeout);
      imagesReady = true;
      if (!disposed && !pausedRef.current) reveal();
    };

    const updateMotion = () => {
      if (disposed) return;
      if (
        motionPreference.matches ||
        root.dataset.a11yReduceMotion === "true" ||
        typeof window.IntersectionObserver !== "function"
      ) {
        reveal();
        return;
      }
      if (scene.dataset.revealed === "true") return;
      if (pausedRef.current || root.dataset.siteReady === "false") {
        // Prepare once, without consuming the entrance behind a modal.
        scene.dataset.revealReady = "true";
        observer?.disconnect();
        observer = undefined;
        return;
      }
      if (requested) {
        if (imagesReady) reveal();
        return;
      }

      scene.dataset.revealReady = "true";
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          if (
            entries.some(
              (entry) =>
                entry.isIntersecting && entry.intersectionRatio >= 0.35,
            )
          ) {
            void prepareImagesAndReveal();
          }
        },
        { threshold: 0.35, rootMargin: "0px 0px -6% 0px" },
      );
      observer.observe(scene);
    };

    const accessibilityObserver = new MutationObserver(updateMotion);
    accessibilityObserver.observe(root, {
      attributes: true,
      attributeFilter: ["data-a11y-reduce-motion"],
    });
    motionPreference.addEventListener("change", updateMotion);
    window.addEventListener("site:ready", updateMotion, { once: true });
    refreshRef.current = updateMotion;
    updateMotion();

    return () => {
      disposed = true;
      refreshRef.current = null;
      clearTimeout(decodeTimeout);
      observer?.disconnect();
      accessibilityObserver.disconnect();
      motionPreference.removeEventListener("change", updateMotion);
      window.removeEventListener("site:ready", updateMotion);
      delete scene.dataset.revealReady;
    };
  }, []);

  useLayoutEffect(() => {
    refreshRef.current?.();
  }, [paused]);

  return (
    <div className="intro-visual" aria-hidden="true" ref={sceneRef}>
      {children}
    </div>
  );
}
