import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Globe2,
  Menu,
  X,
} from "lucide-react";
import { BrandArtwork } from "../brand/BrandArtwork";
import { serviceArtwork } from "../brand/serviceArtwork";
import { getContent, organization } from "../content";
import "./navigation.css";

const t = getContent();
const MENU_CLOSE_MS = 300;

type SiteHeaderProps = {
  page: "home" | "services" | "team";
  activeSection: string;
  onBook: () => void;
};

function prefersLessMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.a11yReduceMotion === "true"
  );
}

function BrandLink({
  onClick,
}: {
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      className="sk-brand"
      href="/"
      aria-label={`${organization.publicName} — на главную`}
      onClick={onClick}
    >
      <BrandArtwork />
    </a>
  );
}

function Language() {
  return (
    <span className="sk-language" aria-label={t.header.language}>
      <Globe2 size={17} aria-hidden="true" /> RU
    </span>
  );
}

export default function SiteHeader({
  page,
  activeSection,
  onBook,
}: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(window.scrollY > 60);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const servicesButton = useRef<HTMLButtonElement>(null);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const openingFrame = useRef<number | undefined>(undefined);
  const replayingLink = useRef(false);
  const closingMobile = useRef(false);
  const afterClose = useRef<(() => void) | undefined>(undefined);

  const navHref = (id: string) => (id === "team" ? "/team/" : `/#${id}`);
  const isActive = (id: string) =>
    page === "home" ? activeSection === id : page === id;

  function finishMobileClose() {
    if (closeTimer.current !== undefined)
      window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
    const next = afterClose.current;
    afterClose.current = undefined;
    mobileDialog.current?.close();
    setMobileOpen(false);
    setMobileVisible(false);
    setMobileServicesOpen(false);
    closingMobile.current = false;
    next?.();
  }

  function closeMobile(next?: () => void, immediately = false) {
    if (!mobileDialog.current?.open) {
      next?.();
      return;
    }
    if (closingMobile.current && !immediately) return;
    closingMobile.current = true;
    afterClose.current = next;
    if (openingFrame.current !== undefined)
      cancelAnimationFrame(openingFrame.current);
    setMobileVisible(false);
    if (immediately || prefersLessMotion()) finishMobileClose();
    else
      closeTimer.current = window.setTimeout(finishMobileClose, MENU_CLOSE_MS);
  }

  function openMobile() {
    const dialog = mobileDialog.current;
    if (!dialog || dialog.open) return;
    setMegaOpen(false);
    closingMobile.current = false;
    setMobileOpen(true);
    dialog.showModal();
    dialog.scrollTop = 0;
    // A painted initial state gives showModal an entrance transition too.
    openingFrame.current = requestAnimationFrame(() => {
      openingFrame.current = requestAnimationFrame(() =>
        setMobileVisible(true),
      );
    });
  }

  function followMobileLink(event: MouseEvent<HTMLAnchorElement>) {
    if (
      replayingLink.current ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const link = event.currentTarget;
    closeMobile(() => {
      // Route only after the modal releases focus and the document scroll lock.
      replayingLink.current = true;
      link.click();
      replayingLink.current = false;
    });
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMegaOpen(false);
  }, [page, activeSection]);

  useEffect(() => {
    if (!megaOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!servicesRef.current?.contains(event.target as Node))
        setMegaOpen(false);
    };
    const onFocus = (event: FocusEvent) => {
      if (!servicesRef.current?.contains(event.target as Node))
        setMegaOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMegaOpen(false);
        servicesButton.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKey);
    };
  }, [megaOpen]);

  useEffect(() => {
    const closeOverlays = () => {
      setMegaOpen(false);
      closeMobile(undefined, true);
    };
    const onResize = () => {
      if (
        mobileToggle.current &&
        getComputedStyle(mobileToggle.current).display === "none"
      )
        closeMobile(undefined, true);
      else setMegaOpen(false);
    };
    window.addEventListener("kodu:accessibility-open", closeOverlays);
    window.addEventListener("resize", onResize);
    window.addEventListener("popstate", closeOverlays);
    window.addEventListener("hashchange", closeOverlays);
    window.addEventListener("sotsiaal:navigate", closeOverlays);
    return () => {
      window.removeEventListener("kodu:accessibility-open", closeOverlays);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("popstate", closeOverlays);
      window.removeEventListener("hashchange", closeOverlays);
      window.removeEventListener("sotsiaal:navigate", closeOverlays);
      if (closeTimer.current !== undefined)
        window.clearTimeout(closeTimer.current);
      if (openingFrame.current !== undefined)
        cancelAnimationFrame(openingFrame.current);
    };
  }, []);

  return (
    <header
      className={`site-header sk-header${scrolled || page !== "home" ? " sk-header-solid" : ""}${megaOpen ? " sk-header-expanded" : ""}`}
    >
      <div className="sk-header-bar container">
        <BrandLink />
        <nav
          id="main-navigation"
          className="sk-desktop-nav"
          aria-label={t.common.mainNavigation}
        >
          <div className="sk-services-nav" ref={servicesRef}>
            <button
              ref={servicesButton}
              className="sk-nav-link sk-services-trigger"
              aria-expanded={megaOpen}
              aria-controls="services-mega-menu"
              data-active={isActive("services")}
              onClick={() => setMegaOpen(!megaOpen)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setMegaOpen(true);
                  requestAnimationFrame(() =>
                    servicesRef.current
                      ?.querySelector<HTMLAnchorElement>(".sk-mega-card")
                      ?.focus(),
                  );
                }
              }}
            >
              {t.header.nav[0].label}
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            <div
              id="services-mega-menu"
              className="sk-mega-menu"
              data-open={megaOpen}
              inert={!megaOpen}
              aria-hidden={!megaOpen}
            >
              <div className="sk-mega-grid">
                {t.services.map((service) => (
                  <a
                    className="sk-mega-card"
                    key={service.id}
                    href={`/services/#${service.id}`}
                    onClick={() => setMegaOpen(false)}
                  >
                    <div className="sk-mega-card-top">
                      <span className="sk-mega-number">{service.number}</span>
                      <img
                        src={serviceArtwork[service.icon]}
                        alt=""
                        width="88"
                        height="88"
                      />
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </div>
                    <strong>{service.shortTitle}</strong>
                    <p>{service.description}</p>
                  </a>
                ))}
              </div>
              <div className="sk-mega-footer">
                <a
                  className="sk-all-services"
                  href="/services/"
                  onClick={() => setMegaOpen(false)}
                >
                  {t.common.allServices}
                  <ArrowRight size={19} aria-hidden="true" />
                </a>
                <span>Найдём поддержку вместе.</span>
                <button
                  className="sk-mega-book"
                  onClick={() => {
                    setMegaOpen(false);
                    onBook();
                  }}
                >
                  {t.common.book}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          {t.header.nav.slice(1).map((item) => (
            <a
              className="sk-nav-link"
              key={item.id}
              href={navHref(item.id)}
              data-active={isActive(item.id)}
              aria-current={
                isActive(item.id)
                  ? item.id === "team"
                    ? "page"
                    : "location"
                  : undefined
              }
              onClick={() => setMegaOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sk-header-actions">
          <Language />
          <button className="sk-header-book" onClick={onBook}>
            {t.common.book}
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
          <button
            ref={mobileToggle}
            className="sk-menu-toggle"
            aria-label={t.header.menu}
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
            onClick={openMobile}
          >
            <Menu size={24} aria-hidden="true" />
          </button>
        </div>
      </div>
      <dialog
        id="mobile-navigation"
        ref={mobileDialog}
        className="sk-mobile-menu"
        data-visible={mobileVisible}
        aria-label={t.common.mainNavigation}
        onCancel={(event) => {
          event.preventDefault();
          closeMobile();
        }}
        onClose={() => {
          setMobileOpen(false);
          setMobileVisible(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled]), [tabindex='0']",
            ),
          ).filter(
            (element) =>
              !element.closest("[inert]") &&
              element.getClientRects().length > 0,
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="sk-mobile-top">
          <BrandLink onClick={followMobileLink} />
          <div className="sk-mobile-top-actions">
            <Language />
            <button
              className="sk-mobile-close"
              aria-label={t.header.closeMenu}
              onClick={() => closeMobile()}
              autoFocus
            >
              <X size={25} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="sk-mobile-content">
          <p className="sk-mobile-label">Пространство заботы</p>
          <nav className="sk-mobile-nav" aria-label="Разделы сайта">
            <div className="sk-mobile-services">
              <button
                className="sk-mobile-link"
                aria-expanded={mobileServicesOpen}
                aria-controls="mobile-service-links"
                onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
              >
                <span className="sk-mobile-number" aria-hidden="true">
                  01
                </span>
                <span>Услуги</span>
                <ChevronDown size={25} aria-hidden="true" />
              </button>
              <div
                id="mobile-service-links"
                className="sk-mobile-service-reveal"
                data-open={mobileServicesOpen}
                inert={!mobileServicesOpen}
                aria-hidden={!mobileServicesOpen}
              >
                <div className="sk-mobile-service-inner">
                  <div className="sk-mobile-service-list">
                    {t.services.map((service) => (
                      <a
                        key={service.id}
                        href={`/services/#${service.id}`}
                        onClick={followMobileLink}
                      >
                        <img
                          src={serviceArtwork[service.icon]}
                          alt=""
                          width="44"
                          height="44"
                        />
                        <span>{service.shortTitle}</span>
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </a>
                    ))}
                    <a
                      className="sk-mobile-all-services"
                      href="/services/"
                      onClick={followMobileLink}
                    >
                      {t.common.allServices}
                      <ArrowRight size={20} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
            {t.header.nav.slice(1).map((item, index) => (
              <a
                className="sk-mobile-link"
                key={item.id}
                href={navHref(item.id)}
                onClick={followMobileLink}
                aria-current={
                  isActive(item.id)
                    ? item.id === "team"
                      ? "page"
                      : "location"
                    : undefined
                }
              >
                <span className="sk-mobile-number" aria-hidden="true">
                  0{index + 2}
                </span>
                <span>{item.label}</span>
                <ArrowUpRight size={24} aria-hidden="true" />
              </a>
            ))}
          </nav>
          <div className="sk-mobile-footer">
            <button
              className="sk-mobile-book"
              onClick={() => closeMobile(onBook)}
            >
              <span>{t.common.book}</span>
              <span className="sk-mobile-book-arrow">
                <ArrowUpRight size={24} aria-hidden="true" />
              </span>
            </button>
            <a className="sk-mobile-phone" href={`tel:${organization.phone}`}>
              {organization.phoneDisplay}
            </a>
            <p>{t.header.top}</p>
          </div>
        </div>
      </dialog>
    </header>
  );
}
