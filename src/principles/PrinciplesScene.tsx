import { useLayoutEffect, useRef } from "react";
import "./principles-motion.css";

type PrinciplesSceneProps = {
  values: readonly { title: string; text: string }[];
};

export default function PrinciplesScene({ values }: PrinciplesSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const cards = Array.from(
      scene.querySelectorAll<HTMLElement>(".principle-card"),
    );
    const root = document.documentElement;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let observer: IntersectionObserver | undefined;
    let disposed = false;

    const revealAll = () => {
      observer?.disconnect();
      observer = undefined;
      delete scene.dataset.revealReady;
      scene.dataset.branchRevealed = "true";
      cards.forEach((card) => {
        card.dataset.revealed = "true";
      });
    };

    const updateMotion = () => {
      if (disposed) return;
      if (root.dataset.siteReady === "false") {
        // Keep the first pose ready without consuming the entrance under the loader.
        scene.dataset.revealReady = "true";
        observer?.disconnect();
        observer = undefined;
        return;
      }
      if (
        motionPreference.matches ||
        root.dataset.a11yReduceMotion === "true" ||
        typeof window.IntersectionObserver !== "function"
      ) {
        revealAll();
        return;
      }

      const pending = cards.filter((card) => card.dataset.revealed !== "true");
      if (!pending.length) return;

      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          if (disposed || root.dataset.siteReady === "false") return;
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
              scene.dataset.branchRevealed = "true";
              const branch =
                scene.querySelector<HTMLImageElement>(".principles-branch");
              if (branch) branch.loading = "eager";
              (entry.target as HTMLElement).dataset.revealed = "true";
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
      );
      pending.forEach((card) => observer!.observe(card));
      scene.dataset.revealReady = "true";
    };

    const accessibilityObserver = new MutationObserver(updateMotion);
    accessibilityObserver.observe(root, {
      attributes: true,
      attributeFilter: ["data-a11y-reduce-motion"],
    });
    motionPreference.addEventListener("change", updateMotion);
    window.addEventListener("site:ready", updateMotion, { once: true });
    updateMotion();

    return () => {
      disposed = true;
      observer?.disconnect();
      accessibilityObserver.disconnect();
      motionPreference.removeEventListener("change", updateMotion);
      window.removeEventListener("site:ready", updateMotion);
      delete scene.dataset.revealReady;
    };
  }, [values.length]);

  return (
    <div className="principles-scene" ref={sceneRef}>
      <img
        className="principles-branch"
        src="/images/calm-branch.webp"
        alt=""
        width="1536"
        height="512"
        loading="lazy"
      />
      <div className="principles-grid container">
        {values.map((value, i) => (
          <article className={`principle-card principle-${i}`} key={i}>
            <span className="eyebrow">{String(i + 1).padStart(2, "0")}</span>
            <h3>{value.title}</h3>
            <p>{value.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
