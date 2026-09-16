import { useLayoutEffect, useRef, type RefObject } from "react";
import "./hero-motion.css";

const EASE = "cubic-bezier(0.19, 1, 0.22, 1)";

type HeroController = {
  element: HTMLElement;
  setPaused: (paused: boolean) => void;
  dispose: () => void;
};

function createHeroMotion(
  scene: HTMLElement,
  initiallyPaused: boolean,
): HeroController {
  const root = document.documentElement;
  const image = scene.querySelector<HTMLImageElement>(".hero-image > img");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const supportsMotion =
    typeof scene.animate === "function" &&
    typeof window.IntersectionObserver === "function";
  const animations = new Set<Animation>();
  let paused = initiallyPaused;
  let disposed = false;
  let started = false;
  let playing = false;
  let inView =
    scene.getBoundingClientRect().bottom > 0 &&
    scene.getBoundingClientRect().top < window.innerHeight;
  let pointerFrame: number | undefined;
  let lastFrame = 0;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;

  scene.dataset.heroMotion = "waiting";

  const reduced = () =>
    reducedMotion.matches || root.dataset.a11yReduceMotion === "true";
  const covered = () =>
    paused ||
    document.hidden ||
    !!document.querySelector(
      'dialog[open], .sk-services-trigger[aria-expanded="true"]',
    );

  const writePointer = () => {
    scene.style.setProperty("--hero-pointer-x", `${currentX.toFixed(3)}px`);
    scene.style.setProperty("--hero-pointer-y", `${currentY.toFixed(3)}px`);
    scene.style.setProperty(
      "--hero-pointer-rx",
      `${(-currentY * 0.3).toFixed(3)}deg`,
    );
    scene.style.setProperty(
      "--hero-pointer-ry",
      `${(currentX * 0.24).toFixed(3)}deg`,
    );
  };

  const resetPointer = () => {
    if (pointerFrame !== undefined) cancelAnimationFrame(pointerFrame);
    pointerFrame = undefined;
    lastFrame = 0;
    currentX = currentY = targetX = targetY = 0;
    writePointer();
  };

  const canTrack = () =>
    supportsMotion &&
    !disposed &&
    !playing &&
    started &&
    inView &&
    finePointer.matches &&
    !reduced() &&
    !covered();

  const settlePointer = (time: number) => {
    pointerFrame = undefined;
    if (!canTrack()) {
      resetPointer();
      return;
    }
    const delta = lastFrame ? Math.min(time - lastFrame, 48) : 16;
    lastFrame = time;
    const weight = 1 - Math.exp(-delta / 95);
    currentX += (targetX - currentX) * weight;
    currentY += (targetY - currentY) * weight;
    if (
      Math.abs(targetX - currentX) < 0.008 &&
      Math.abs(targetY - currentY) < 0.008
    ) {
      currentX = targetX;
      currentY = targetY;
      lastFrame = 0;
    } else {
      pointerFrame = requestAnimationFrame(settlePointer);
    }
    writePointer();
  };

  const requestPointer = () => {
    if (pointerFrame === undefined)
      pointerFrame = requestAnimationFrame(settlePointer);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !canTrack()) return;
    const bounds = scene.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
    );
    const y = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
    );
    targetX = x * 5;
    targetY = y * 3.5;
    requestPointer();
  };

  const onPointerLeave = () => {
    targetX = targetY = 0;
    if (canTrack()) requestPointer();
    else resetPointer();
  };

  const finishEntrance = () => {
    for (const animation of animations) animation.cancel();
    animations.clear();
    playing = false;
    scene.dataset.heroMotion = "ready";
  };

  const animate = (
    element: Element | null,
    frames: Keyframe[],
    duration: number,
    delay = 0,
  ) => {
    if (!element) return;
    // Backwards fill supplies the first pose only while waiting. Nothing stays
    // attached after finishing, so hover, focus, and the original layout win.
    animations.add(
      element.animate(frames, {
        duration,
        delay,
        easing: EASE,
        fill: "backwards",
      }),
    );
  };

  const startEntrance = () => {
    if (disposed || started || !inView || covered()) return;
    started = true;
    if (!supportsMotion || reduced()) {
      finishEntrance();
      return;
    }
    playing = true;
    scene.dataset.heroMotion = "entering";
    const panels = scene.querySelectorAll(".hero-panels > span");
    panels.forEach((panel, index) =>
      animate(
        panel,
        [
          {
            transform: `perspective(1600px) rotateY(${index ? -4.5 : 4.5}deg)`,
            clipPath: "inset(1.2% 1.5% 1.2% 1.5% round 52px)",
          },
          {
            transform: "perspective(1600px) rotateY(0deg)",
            clipPath: "inset(0% 0% 0% 0% round 44px)",
          },
        ],
        1250,
        index * 50,
      ),
    );
    animate(
      image,
      [
        {
          clipPath: "ellipse(35% 31% at 50% 68%)",
          transform: "scale(0.9) rotate(-3deg)",
          opacity: 0.12,
        },
        {
          clipPath: "ellipse(65% 63% at 50% 54%)",
          transform: "scale(0.987) rotate(-0.3deg)",
          opacity: 1,
          offset: 0.65,
        },
        {
          clipPath: "ellipse(100% 100% at 50% 50%)",
          transform: "scale(1) rotate(0deg)",
          opacity: 1,
        },
      ],
      1280,
      90,
    );
    animate(
      scene.querySelector(".hero-label"),
      [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }],
      780,
      160,
    );
    scene.querySelectorAll(".hero-title-line").forEach((line, index) =>
      animate(
        line,
        [
          {
            clipPath: "inset(0 -3px 100% -3px)",
            transform: "perspective(900px) rotateX(-12deg)",
          },
          {
            clipPath: "inset(0 -3px -8px -3px)",
            transform: "perspective(900px) rotateX(0deg)",
          },
        ],
        990,
        230 + index * 130,
      ),
    );
    animate(
      scene.querySelector(".hero-actions"),
      [
        { clipPath: "inset(-4px 100% -4px -4px round 40px)" },
        { clipPath: "inset(-4px -4px -4px -4px round 40px)" },
      ],
      760,
      500,
    );
    // Keep focusable card bounds fixed: moving them during an entrance can
    // retrigger the browser's automatic reveal and shift the document scroll.
    scene.querySelectorAll(".hero-shortcut").forEach((shortcut, index) =>
      animate(
        shortcut,
        [
          {
            clipPath: "inset(8% 0 12% 0 round 30px)",
            opacity: 0.15,
          },
          {
            clipPath: "inset(-4px -4px -18px -4px round 23px)",
            opacity: 1,
          },
        ],
        780,
        470 + index * 110,
      ),
    );
    scene
      .querySelectorAll(".hero-support > *")
      .forEach((element, index) =>
        animate(
          element,
          [
            { clipPath: "inset(0 100% 0 0)" },
            { clipPath: "inset(-3px -3px -3px -3px)" },
          ],
          790,
          400 + index * 90,
        ),
      );
    void Promise.allSettled(
      Array.from(animations, (animation) => animation.finished),
    ).then(() => {
      if (!disposed) finishEntrance();
    });
  };

  const refresh = () => {
    if (disposed) return;
    if (reduced() || covered()) {
      resetPointer();
      if (playing) finishEntrance();
    }
    startEntrance();
  };

  const onFocus = () => {
    // Keyboard navigation never has to wait for the decorative opening.
    if (playing) finishEntrance();
    resetPointer();
  };

  const visibilityObserver = supportsMotion
    ? new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
        if (!inView) resetPointer();
        else refresh();
      })
    : undefined;
  visibilityObserver?.observe(scene);
  const preferencesObserver = new MutationObserver(refresh);
  preferencesObserver.observe(root, {
    attributes: true,
    attributeFilter: ["data-a11y-reduce-motion"],
  });
  const overlaysObserver = new MutationObserver(refresh);
  overlaysObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open", "aria-expanded"],
  });
  reducedMotion.addEventListener("change", refresh);
  finePointer.addEventListener("change", resetPointer);
  document.addEventListener("visibilitychange", refresh);
  scene.addEventListener("pointermove", onPointerMove, { passive: true });
  scene.addEventListener("pointerleave", onPointerLeave, { passive: true });
  scene.addEventListener("focusin", onFocus);
  refresh();

  return {
    element: scene,
    setPaused(value) {
      paused = value;
      refresh();
    },
    dispose() {
      disposed = true;
      resetPointer();
      finishEntrance();
      visibilityObserver?.disconnect();
      preferencesObserver.disconnect();
      overlaysObserver.disconnect();
      reducedMotion.removeEventListener("change", refresh);
      finePointer.removeEventListener("change", resetPointer);
      document.removeEventListener("visibilitychange", refresh);
      scene.removeEventListener("pointermove", onPointerMove);
      scene.removeEventListener("pointerleave", onPointerLeave);
      scene.removeEventListener("focusin", onFocus);
      delete scene.dataset.heroMotion;
      for (const property of [
        "--hero-pointer-x",
        "--hero-pointer-y",
        "--hero-pointer-rx",
        "--hero-pointer-ry",
      ]) {
        scene.style.removeProperty(property);
      }
    },
  };
}

export default function useHeroMotion(
  ref: RefObject<HTMLElement | null>,
  paused: boolean,
) {
  const controller = useRef<HeroController | null>(null);

  // The same App stays mounted across routes; reconcile the actual section,
  // rather than the stable ref object, when a home section mounts again.
  useLayoutEffect(() => {
    if (controller.current?.element !== ref.current) {
      controller.current?.dispose();
      controller.current = ref.current
        ? createHeroMotion(ref.current, paused)
        : null;
    } else {
      controller.current?.setPaused(paused);
    }
  });

  useLayoutEffect(
    () => () => {
      controller.current?.dispose();
      controller.current = null;
    },
    [],
  );
}
