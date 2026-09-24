import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { languages, setLocale, tr, useLocale, type Locale } from "../i18n";
import "./language-switcher.css";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const selected = languages.findIndex(({ code }) => code === locale);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function show(index = selected) {
    setOpen(true);
    requestAnimationFrame(() =>
      options.current[index]?.focus({ preventScroll: true }),
    );
  }

  function choose(code: Locale) {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
    setLocale(code);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = options.current.findIndex(
      (element) => element === document.activeElement,
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? languages.length - 1
          : index < 0
            ? selected
            : (index +
                (event.key === "ArrowDown" ? 1 : -1) +
                languages.length) %
              languages.length;
    if (open) options.current[next]?.focus();
    else show(next);
  }

  return (
    <div
      className="language-switcher"
      data-open={open}
      ref={root}
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="sk-language language-trigger"
        aria-label={`${tr("Выбрать язык")}: ${languages[selected].name}`}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <Globe2 size={17} aria-hidden="true" />
        <span>{locale.toUpperCase()}</span>
        <ChevronDown
          className="language-chevron"
          size={13}
          aria-hidden="true"
        />
      </button>
      <div
        id={menuId}
        className="language-menu"
        role="menu"
        aria-label={tr("Выбрать язык")}
        aria-hidden={!open}
        inert={!open}
      >
        {languages.map(({ code, name }, index) => (
          <button
            key={code}
            ref={(element) => {
              options.current[index] = element;
            }}
            type="button"
            role="menuitemradio"
            aria-checked={locale === code}
            className="language-option"
            tabIndex={-1}
            lang={code}
            onClick={() => choose(code)}
          >
            <span className="language-code" aria-hidden="true">
              {code.toUpperCase()}
            </span>
            <span>{name}</span>
            {locale === code && <Check size={16} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
