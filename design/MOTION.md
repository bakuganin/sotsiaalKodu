# Site motion

The home, services and team pages share a finite, viewport-driven motion system. Content retains its original layout and artwork. No scroll hijacking, pinning, autoplay loops, preloader or WebGL are used.

## Choreography

- Hero: two panels unfold around their seam; the original house photograph appears through a growing ellipse; title lines reveal individually. Fine-pointer input adds at most 5px displacement and 1.2deg rotation, with an input-driven settling loop.
- Section headings: shaped text masks, gently hinged glass artwork and delayed supporting copy.
- Service cards: shallow perspective and a separate illustration reveal; hover adds a small lift and rotation. The service index also catches a soft light sweep.
- Intro and principles: tapered branch masks, portraits opening from their base, a leaf opening from its attachment, and circular lens apertures. Existing responsive arrangement remains intact.
- Story photos: rounded aperture plus a small lens-like zoom settling into the original crop.
- Process, FAQ and contact rows: horizontal rule reveals; existing accordion and modal open/close behavior remains accessible.
- Team: gallery aperture and shallow unfolding of active profiles. The tall mobile gallery uses no perspective to avoid overflow with enlarged text.
- Contact spread: opposing panels open around the seam. Footer elements finish with short ruled reveals.

## Reuse

`useSiteMotion` observes `[data-motion]` in the current route. Supported values: `heading`, `object`, `card`, `aperture`, `line`, `copy`, `pair`. `heading` works on a heading or a container with direct heading children. Optional `data-motion-delay` is clamped to 0–240ms.

The controller owns `data-motion-state`: `pending`, `running`, `settled`. Default markup is fully visible; pending poses are installed only when the observer works. Completion removes animation styles; a bounded fallback settles even if animation events are missing. Elements animate once per route mount, and observers/listeners/timers are removed on route changes.

Hero starts after the development notice is acknowledged. Focus and anchor navigation reveal target content immediately. Opening dialogs settles ongoing entrances and postpones new ones. Both OS and website reduced-motion preferences take effect live, revealing content and disabling added motion. Missing IntersectionObserver leaves the complete page visible.

Timings and curves are in `src/motion/site-motion.css`, hero choreography in `useHeroMotion.ts`, botanical scenes in their dedicated files. No external animation dependency was added.

## Verification

`tests/site-motion.spec.ts` checks actual painted shape/depth frames, one-time reveals, startup notice timing, navigation and booking, focus/hash destinations, both reduced-motion controls, unavailable observers, and narrow layouts including 200% text. Existing scene, dialog, navigation, team and accessibility suites cover their interactions. Visual snapshots are in `design/motion/`.
