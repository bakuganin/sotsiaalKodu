import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PersonStanding, RotateCcw, X } from "lucide-react";
import {
  applyPreferences,
  defaultPreferences,
  readPreferences,
  writePreferences,
  type AccessibilityPreferences,
} from "./preferences";
import { accessibilityCopy as copy } from "./ru";

export default function AccessibilityWidget() {
  const [preferences, setPreferences] = useState(readPreferences);
  const [isOpen, setIsOpen] = useState(false);
  const [launcherHost, setLauncherHost] = useState<HTMLElement>(document.body);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const sourceModalRef = useRef<HTMLDialogElement | null>(null);
  const restoreFrame = useRef<number | null>(null);
  const id = useId();
  const dialogId = `${id}-dialog`;
  const headingId = `${id}-heading`;
  const descriptionId = `${id}-description`;

  function updatePreference<Key extends keyof AccessibilityPreferences>(
    key: Key,
    value: AccessibilityPreferences[Key],
  ) {
    setPreferences((previous) => ({ ...previous, [key]: value }));
  }

  useEffect(() => {
    applyPreferences(preferences);
    writePreferences(preferences);
  }, [preferences]);

  const finishClosing = useCallback(() => {
    if (dialogRef.current?.open) return;
    setIsOpen(false);
    sourceModalRef.current = null;
    if (restoreFrame.current !== null)
      cancelAnimationFrame(restoreFrame.current);
    restoreFrame.current = requestAnimationFrame(() => {
      const launcher = launcherRef.current;
      if (launcher?.isConnected && !launcher.closest("dialog:not([open])")) {
        launcher.focus({ preventScroll: true });
      }
      restoreFrame.current = null;
    });
  }, []);

  const closePanel = useCallback(() => {
    if (dialogRef.current?.open) dialogRef.current.close();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus({ preventScroll: true });
    }
  }, [isOpen]);

  useEffect(() => {
    // A button in the document body is inert while another modal is open.
    // Move only the launcher into that modal; settings have their own top layer.
    const activationOrder = new WeakMap<HTMLDialogElement, number>();
    let activation = 0;
    const syncLauncherHost = (records: MutationRecord[] = []) => {
      for (const record of records) {
        if (
          record.type === "attributes" &&
          record.target instanceof HTMLDialogElement &&
          record.target.open
        ) {
          activationOrder.set(record.target, ++activation);
        }
      }
      const otherModals = Array.from(
        document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
      ).filter(
        (dialog) => dialog !== dialogRef.current && dialog.matches(":modal"),
      );
      for (const modal of otherModals) {
        if (!activationOrder.has(modal))
          activationOrder.set(modal, ++activation);
      }
      otherModals.sort(
        (first, second) =>
          (activationOrder.get(first) ?? 0) -
          (activationOrder.get(second) ?? 0),
      );
      setLauncherHost(otherModals.at(-1) ?? document.body);

      const sourceModal = sourceModalRef.current;
      if (sourceModal && (!sourceModal.open || !sourceModal.isConnected)) {
        sourceModalRef.current = null;
        closePanel();
      }
    };
    syncLauncherHost();
    const observer = new MutationObserver(syncLauncherHost);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => {
      observer.disconnect();
      if (restoreFrame.current !== null)
        cancelAnimationFrame(restoreFrame.current);
    };
  }, [closePanel]);

  useEffect(() => {
    if (!preferences.readingGuide || isOpen) return;
    let position = window.innerHeight * 0.45;
    let frame: number | null = null;
    const paint = () => {
      guideRef.current?.style.setProperty("--a11y-guide-y", `${position}px`);
      frame = null;
    };
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(paint);
    };
    const pointerMove = (event: PointerEvent) => {
      position = event.clientY;
      schedule();
    };
    const keyboardMove = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        !["ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="spinbutton"], [role="tab"], [role="listbox"], [role="combobox"], [role="menu"]',
        )
      ) {
        return;
      }
      event.preventDefault();
      position = Math.min(
        Math.max(position + (event.key === "ArrowDown" ? 24 : -24), 0),
        window.innerHeight,
      );
      schedule();
    };
    const resize = () => {
      position = Math.min(position, window.innerHeight);
      schedule();
    };
    paint();
    document.addEventListener("pointermove", pointerMove, { passive: true });
    document.addEventListener("keydown", keyboardMove);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("keydown", keyboardMove);
      window.removeEventListener("resize", resize);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [preferences.readingGuide, isOpen, launcherHost]);

  function openPanel() {
    window.dispatchEvent(new CustomEvent("kodu:accessibility-open"));
    sourceModalRef.current = launcherRef.current?.closest("dialog") ?? null;
    setIsOpen(true);
  }

  return (
    <>
      {createPortal(
        <>
          <button
            ref={launcherRef}
            type="button"
            className="a11y-launcher"
            aria-label={copy.title}
            aria-haspopup="dialog"
            aria-controls={dialogId}
            aria-expanded={isOpen}
            onClick={openPanel}
          >
            <PersonStanding size={28} aria-hidden="true" />
          </button>
          {preferences.readingGuide && !isOpen && (
            <div
              ref={guideRef}
              className="a11y-reading-guide"
              aria-hidden="true"
            />
          )}
        </>,
        launcherHost,
      )}
      {createPortal(
        <dialog
          ref={dialogRef}
          id={dialogId}
          className="a11y-dialog"
          aria-labelledby={headingId}
          aria-describedby={descriptionId}
          onClose={finishClosing}
          onCancel={(event) => {
            event.preventDefault();
            closePanel();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const first = closeRef.current;
            const last =
              event.currentTarget.querySelector<HTMLButtonElement>(
                ".a11y-reset",
              );
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            ) {
              closePanel();
            }
          }}
        >
          <div className="a11y-panel">
            <header className="a11y-header">
              <div>
                <h2 id={headingId}>{copy.title}</h2>
                <p id={descriptionId}>{copy.description}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="a11y-close"
                aria-label={copy.close}
                onClick={closePanel}
              >
                <X size={21} aria-hidden="true" />
              </button>
            </header>
            <div className="a11y-body">
              <fieldset className="a11y-group">
                <legend>{copy.textSize.title}</legend>
                <div className="a11y-options">
                  {copy.textSize.options.map((option) => (
                    <label key={option.value} className="a11y-option">
                      <input
                        type="radio"
                        name={`${id}-text-size`}
                        value={option.value}
                        checked={preferences.textSize === option.value}
                        onChange={() =>
                          updatePreference("textSize", option.value)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="a11y-group">
                <legend>{copy.contrast.title}</legend>
                <div className="a11y-options">
                  {copy.contrast.options.map((option) => (
                    <label key={option.value} className="a11y-option">
                      <input
                        type="radio"
                        name={`${id}-contrast`}
                        value={option.value}
                        checked={preferences.contrast === option.value}
                        onChange={() =>
                          updatePreference("contrast", option.value)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="a11y-group">
                <legend>{copy.colorMode.title}</legend>
                <p className="a11y-group-description">
                  {copy.colorMode.description}
                </p>
                <div className="a11y-options">
                  {copy.colorMode.options.map((option) => (
                    <label key={option.value} className="a11y-option">
                      <input
                        type="radio"
                        name={`${id}-color-mode`}
                        value={option.value}
                        checked={preferences.colorMode === option.value}
                        onChange={() =>
                          updatePreference("colorMode", option.value)
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="a11y-group a11y-toggles">
                <legend>{copy.togglesTitle}</legend>
                {copy.toggles.map((toggle) => (
                  <label key={toggle.key} className="a11y-toggle">
                    <input
                      type="checkbox"
                      checked={preferences[toggle.key]}
                      onChange={(event) =>
                        updatePreference(
                          toggle.key,
                          event.currentTarget.checked,
                        )
                      }
                      aria-labelledby={`${id}-${toggle.key}-label`}
                      aria-describedby={`${id}-${toggle.key}-description`}
                    />
                    <span className="a11y-toggle-text">
                      <strong id={`${id}-${toggle.key}-label`}>
                        {toggle.label}
                      </strong>
                      <small id={`${id}-${toggle.key}-description`}>
                        {toggle.description}
                      </small>
                    </span>
                    <span className="a11y-switch" aria-hidden="true" />
                  </label>
                ))}
              </fieldset>
            </div>
            <footer className="a11y-footer">
              <button
                type="button"
                className="a11y-reset"
                onClick={() => setPreferences({ ...defaultPreferences })}
              >
                <RotateCcw size={17} aria-hidden="true" />
                {copy.reset}
              </button>
              <p className="a11y-note">{copy.saved}</p>
            </footer>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
