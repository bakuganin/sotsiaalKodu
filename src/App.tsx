import "./editorial-redesign.css";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  House,
  Mail,
  Phone,
  Plus,
} from "lucide-react";
import { getContent, organization } from "./content";
import type { Service } from "./content/ru";
import BookingDialog from "./booking/BookingDialog";
import ContentDialog, {
  type ContentDialogHandle,
} from "./dialog/ContentDialog";
import DevelopmentNotice, {
  shouldShowDevelopmentNotice,
} from "./development/DevelopmentNotice";
import TeamSection from "./team/TeamSection";
import PrinciplesScene from "./principles/PrinciplesScene";
import IntroComposition from "./motion/IntroComposition";
import useSiteMotion from "./motion/useSiteMotion";
import useHeroMotion from "./motion/useHeroMotion";
import { usePageMotionGate } from "./motion/PageMotion";
import { AnimatedAccordion } from "./accordion/AnimatedAccordion";
import AccessibilityWidget from "./accessibility/AccessibilityWidget";
import { BrandArtwork } from "./brand/BrandArtwork";
import SectionIcon from "./brand/SectionIcon";
import { serviceArtwork } from "./brand/serviceArtwork";
import SiteHeader from "./navigation/SiteHeader";
import { useSiteRoute } from "./navigation/useSiteRoute";
import ServicesPage from "./pages/ServicesPage";
import TeamPage from "./pages/TeamPage";
import pageMeta from "./content/page-meta.json";

const t = getContent();

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      className={`brand${footer ? " brand-footer" : ""}`}
      href="/"
      aria-label={`${organization.publicName} — на главную`}
    >
      <BrandArtwork />
    </a>
  );
}

function ServiceArt({ type }: { type: Service["icon"] }) {
  return (
    <img
      className={`service-art art-${type}`}
      src={serviceArtwork[type]}
      alt=""
      loading="lazy"
      width="512"
      height="560"
    />
  );
}

export default function App() {
  const siteRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const contentDialog = useRef<ContentDialogHandle>(null);
  const [developmentNoticeOpen, setDevelopmentNoticeOpen] = useState(
    shouldShowDevelopmentNotice,
  );
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingService, setBookingService] = useState<string>();
  const { page, hash, replaceHash } = useSiteRoute();
  const [activeSection, setActiveSection] = useState("");
  const contentOrigin = useRef<{
    hash: string;
    scrollY: number;
    trigger: HTMLElement | null;
  }>({ hash: "", scrollY: window.scrollY, trigger: null });
  const contentFrame = useRef<number | undefined>(undefined);
  const service = t.services.find((item) => hash === `#/services/${item.id}`);
  const privacyOpen = hash === "#/privacy";
  const unknownPage = hash.startsWith("#/") && !service && !privacyOpen;
  const motionPaused = usePageMotionGate(
    developmentNoticeOpen ||
      bookingOpen ||
      !!service ||
      privacyOpen ||
      unknownPage,
  );
  useSiteMotion(siteRef, page, motionPaused);
  useHeroMotion(heroRef, motionPaused);

  useEffect(() => {
    document.documentElement.lang = t.locale;
    document.title = service
      ? `${service.shortTitle} — ${organization.publicName}`
      : pageMeta[page].title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", pageMeta[page].description);
  }, [service, page]);

  useEffect(
    () => () => {
      if (contentFrame.current !== undefined)
        cancelAnimationFrame(contentFrame.current);
    },
    [],
  );

  useEffect(() => {
    if (typeof window.IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-18% 0px -55% 0px" },
    );
    document
      .querySelectorAll("main section[id]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [page]);

  function openBooking(serviceId?: string) {
    setBookingService(serviceId);
    setBookingOpen(true);
  }
  function rememberContentOrigin(trigger: HTMLElement) {
    if (contentFrame.current !== undefined)
      cancelAnimationFrame(contentFrame.current);
    contentOrigin.current = {
      hash: window.location.hash.startsWith("#/") ? "" : window.location.hash,
      scrollY: window.scrollY,
      trigger,
    };
  }
  function dismissContent(restoreFocus: boolean) {
    const origin = contentOrigin.current;
    const destination = origin.hash;
    replaceHash(destination);
    if (contentFrame.current !== undefined)
      cancelAnimationFrame(contentFrame.current);
    contentFrame.current = requestAnimationFrame(() => {
      window.scrollTo({ top: origin.scrollY, behavior: "instant" });
      if (restoreFocus && origin.trigger?.isConnected)
        origin.trigger.focus({ preventScroll: true });
      contentFrame.current = undefined;
    });
  }
  function closeContent() {
    dismissContent(true);
  }
  function showAllServices() {
    if (contentFrame.current !== undefined)
      cancelAnimationFrame(contentFrame.current);
    replaceHash("#services");
    contentFrame.current = requestAnimationFrame(() => {
      const section = document.getElementById("services");
      const reduceMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.a11yReduceMotion === "true";
      section?.focus({ preventScroll: true });
      section?.scrollIntoView({
        behavior: reduceMotion ? "instant" : "smooth",
        block: "start",
      });
      contentFrame.current = undefined;
    });
  }
  function bookFromService(selected: Service) {
    dismissContent(false);
    openBooking(selected.id);
  }

  return (
    <div
      className="site-shell"
      ref={siteRef}
      data-startup-pending={developmentNoticeOpen}
    >
      <a className="skip-link" href="#main">
        {t.header.skip}
      </a>
      <SiteHeader
        page={page}
        activeSection={activeSection}
        onBook={() => openBooking()}
      />
      <main id="main" tabIndex={-1}>
        {page === "services" ? (
          <ServicesPage onBook={openBooking} />
        ) : page === "team" ? (
          <TeamPage onBook={openBooking} />
        ) : (
          <>
            <section id="home" className="hero-section" ref={heroRef}>
              <div className="hero-panels" aria-hidden="true">
                <span />
                <span />
              </div>
              <div className="hero-inner container">
                <p className="hero-label eyebrow">
                  {t.calm.heroLabel}
                  <span className="status-dot" />
                </p>
                <div className="hero-image">
                  <img
                    src="/images/calm-home.webp"
                    alt={t.calm.heroImageAlt}
                    width="1254"
                    height="1254"
                    fetchPriority="high"
                  />
                </div>
                <div className="hero-copy">
                  <h1>
                    <span className="hero-title-line">
                      <span className="hero-title-accent">
                        {t.hero.firstAccent}
                      </span>
                      {t.hero.firstRest}
                    </span>{" "}
                    <span className="hero-title-line">
                      {t.hero.secondLead}
                      <span className="hero-title-accent">
                        {t.hero.secondAccent}
                      </span>
                      .
                    </span>
                  </h1>
                  <div className="hero-actions">
                    <button
                      className="pill-button"
                      onClick={() => openBooking()}
                    >
                      <span>{t.common.book}</span>
                      <span className="pill-arrow">
                        <ArrowRight size={23} />
                      </span>
                    </button>
                  </div>
                </div>
                <div className="hero-shortcuts">
                  {[t.services[3], t.services[1]].map((item, index) => (
                    <a
                      href={`#/services/${item.id}`}
                      key={item.id}
                      className="hero-shortcut"
                      onClick={(e) => {
                        rememberContentOrigin(e.currentTarget);
                      }}
                    >
                      <ServiceArt type={item.icon} />
                      <span>{t.calm.heroLinks[index]}</span>
                      <span className="shortcut-plus">
                        <Plus size={17} />
                      </span>
                    </a>
                  ))}
                </div>
                <div className="hero-support">
                  <p className="eyebrow">{t.calm.heroSupport}</p>
                  <p>{t.hero.description}</p>
                  <a href="#services">
                    {t.hero.secondary}
                    <ArrowDown size={16} />
                  </a>
                </div>
              </div>
            </section>

            <section id="about" className="intro-section">
              <div className="container">
                <div className="center-heading" data-motion="heading">
                  <SectionIcon variant="support" />
                  <h2>
                    {t.calm.introFirst}
                    <br />
                    <span>{t.calm.introAccent}</span>
                    <br />
                    {t.calm.introLast}
                  </h2>
                  <p>{t.calm.introDescription}</p>
                </div>
                <div className="intro-facts">
                  <div className="fact-column">
                    {t.calm.facts.slice(0, 2).map((fact) => (
                      <div
                        className="intro-fact"
                        data-motion="copy"
                        key={fact.value}
                      >
                        <strong>{fact.value}</strong>
                        <span>{fact.label}</span>
                      </div>
                    ))}
                  </div>
                  <IntroComposition paused={motionPaused}>
                    <div className="intro-artworks">
                      <span className="intro-contact">
                        <img
                          className="service-art"
                          src="/images/intro/botanical-butterfly.webp"
                          alt=""
                          width="512"
                          height="512"
                          loading="lazy"
                        />
                      </span>
                      <span className="intro-leaf">
                        <img
                          className="service-art art-flower"
                          src="/images/service-flower.webp"
                          alt=""
                          width="512"
                          height="560"
                          loading="lazy"
                        />
                      </span>
                      <span className="intro-care">
                        <img
                          className="service-art"
                          src="/images/intro/glass-nest.webp"
                          alt=""
                          width="512"
                          height="512"
                          loading="lazy"
                        />
                      </span>
                    </div>
                    <img
                      className="intro-branch"
                      src="/images/calm-branch.webp"
                      alt=""
                      width="1536"
                      height="512"
                      loading="lazy"
                    />
                  </IntroComposition>
                  <div className="fact-column">
                    {t.calm.facts.slice(2).map((fact) => (
                      <div
                        className="intro-fact"
                        data-motion="copy"
                        key={fact.value}
                      >
                        <strong>{fact.value}</strong>
                        <span>{fact.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="page-content">
              <section
                id="services"
                className="services-section container"
                tabIndex={-1}
              >
                <div className="center-heading" data-motion="heading">
                  <SectionIcon variant="services" />
                  <p className="eyebrow">{t.servicesSection.eyebrow}</p>
                  <h2>
                    {t.calm.servicesFirst}
                    <br />
                    <span>{t.calm.servicesAccent}</span>
                    <br />
                    {t.calm.servicesLast}
                  </h2>
                  <p>{t.servicesSection.description}</p>
                </div>
                <div className="services-grid">
                  {t.services.map((item, i) => (
                    <a
                      key={item.id}
                      href={`#/services/${item.id}`}
                      onClick={(e) => {
                        rememberContentOrigin(e.currentTarget);
                      }}
                      className={`service-card service-${i}`}
                      data-motion="card"
                      data-motion-delay={i * 70}
                    >
                      <div className="service-card-top">
                        <span className="service-pill">
                          {t.editorial.servicePills[i]}
                        </span>
                        <span>0{i + 1}</span>
                      </div>
                      <ServiceArt type={item.icon} />
                      <div className="service-info">
                        <h3>{item.title}</h3>
                        <p className="service-description">
                          {item.description}
                        </p>
                        <span className="service-more">
                          {t.servicesSection.cardLink}
                          <ArrowUpRight size={19} />
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
                <div className="services-actions" data-motion="copy">
                  <a className="pill-button" href="/services/">
                    <span>{t.common.allServices}</span>
                    <span className="pill-arrow">
                      <ArrowUpRight size={22} aria-hidden="true" />
                    </span>
                  </a>
                </div>
              </section>

              <section className="principles-section">
                <div className="center-heading container" data-motion="heading">
                  <SectionIcon variant="care" />
                  <h2>
                    {t.calm.valuesFirst}
                    <br />
                    <span>{t.calm.valuesAccent}</span> {t.calm.valuesLast}
                  </h2>
                  <p>{t.calm.valuesDescription}</p>
                </div>
                <PrinciplesScene
                  values={t.about.values}
                  paused={motionPaused}
                />
              </section>

              <section
                className="story-section container"
                aria-label={t.about.eyebrow}
              >
                <article
                  className="story-card story-circle"
                  data-motion="aperture"
                >
                  <span className="eyebrow">{t.calm.storyLabel}</span>
                  <img
                    src="/images/calm-home.webp"
                    alt=""
                    width="1254"
                    height="1254"
                    loading="lazy"
                  />
                  <h2>
                    {t.calm.storyFirst}
                    <br />
                    <span>{t.calm.storyAccent}</span>
                    <br />
                    {t.calm.storyLast}
                  </h2>
                </article>
                <article
                  className="story-card story-photo"
                  data-motion="aperture"
                  data-motion-delay="140"
                >
                  <img
                    src="/images/care-hero.webp"
                    alt={t.editorial.careImageAlt}
                    width="1536"
                    height="1024"
                    loading="lazy"
                  />
                  <div>
                    <span className="eyebrow">{t.calm.careLabel}</span>
                    <h2>
                      <span>{t.calm.careFirstAccent}</span>
                      {t.calm.careFirstRest}
                      <br />
                      {t.calm.careSecondLead}
                      <span>{t.calm.careSecondAccent}</span>.
                    </h2>
                  </div>
                </article>
              </section>

              <TeamSection />

              <section
                className="support-situations container"
                aria-label="С чем можно к нам прийти"
              >
                {t.supportSituations.map((item) => (
                  <article
                    className={`support-situation support-situation-${item.id}`}
                    key={item.id}
                  >
                    <div className="support-situation-art">
                      <img
                        src={`/images/situations/${item.id}.webp`}
                        alt=""
                        width="640"
                        height="640"
                        loading="lazy"
                      />
                    </div>
                    <div className="support-situation-copy">
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </section>

              <section
                className="process-section process-editorial container"
                aria-labelledby="process-title"
              >
                <aside className="process-rail" data-motion="copy">
                  <p className="eyebrow">КАК МЫ ПОМОГАЕМ</p>
                </aside>
                <div className="process-body">
                  <h2
                    id="process-title"
                    className="editorial-statement"
                    data-motion="heading"
                  >
                    Начнём с <span>простого разговора</span> и вместе найдём
                    следующий шаг.
                  </h2>
                  <AnimatedAccordion
                    variant="process"
                    items={t.process.steps}
                    defaultOpenIndex={0}
                  />
                </div>
              </section>

              <section className="faq-section">
                <div className="editorial-section container">
                  <div className="section-rail" data-motion="heading">
                    <p className="eyebrow">{t.faq.eyebrow}</p>
                    <h2 className="display-heading">{t.faq.title}</h2>
                  </div>
                  <AnimatedAccordion
                    variant="faq"
                    items={t.faq.items.map((item) => ({
                      title: item.question,
                      text: item.answer,
                    }))}
                  />
                </div>
              </section>
            </div>

            <section id="contact" className="contact-section">
              <div className="contact-panels" data-motion="pair">
                <div className="contact-visual">
                  <span className="eyebrow">{t.calm.heroLabel}</span>
                  <img
                    src="/images/calm-home.webp"
                    alt=""
                    width="1254"
                    height="1254"
                    loading="lazy"
                  />
                </div>
                <div className="contact-heading">
                  <p className="eyebrow">{t.contact.eyebrow}</p>
                  <h2>
                    {t.calm.contactFirst}
                    <br />
                    <span>{t.calm.contactAccent}</span>
                    <br />
                    {t.calm.contactLast}
                  </h2>
                  <p>{t.contact.description}</p>
                  <button className="pill-button" onClick={() => openBooking()}>
                    <span>{t.common.book}</span>
                    <span className="pill-arrow">
                      <ArrowRight size={23} />
                    </span>
                  </button>
                  <span className="booking-note">{t.contact.bookNote}</span>
                </div>
              </div>
              <div className="contact-bottom container">
                <div className="center-heading" data-motion="heading">
                  <SectionIcon variant="contact" />
                  <h2>
                    {t.calm.questionsFirst}
                    <br />
                    <span>{t.calm.questionsAccent}</span>
                  </h2>
                  <p>{t.contact.description}</p>
                  <button
                    type="button"
                    className="pill-button pill-light"
                    onClick={() => openBooking()}
                    aria-haspopup="dialog"
                  >
                    <span>{t.calm.write}</span>
                    <span className="pill-arrow">
                      <ArrowUpRight size={22} />
                    </span>
                  </button>
                </div>
                <div className="contact-details">
                  <a
                    className="contact-item"
                    data-motion="line"
                    href={`tel:${organization.phone}`}
                  >
                    <Phone size={20} />
                    <span>
                      <small>{t.contact.phoneLabel}</small>
                      <strong>{organization.phoneDisplay}</strong>
                    </span>
                    <ArrowUpRight size={18} />
                  </a>
                  <button
                    type="button"
                    className="contact-item contact-email"
                    data-motion="line"
                    data-motion-delay="70"
                    onClick={() => openBooking()}
                    aria-haspopup="dialog"
                  >
                    <Mail size={20} />
                    <span>
                      <small>{t.contact.emailLabel}</small>
                      <strong>{organization.email}</strong>
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                  <div
                    className="contact-address"
                    data-motion="line"
                    data-motion-delay="140"
                  >
                    <House size={20} />
                    <div>
                      <small>{t.contact.legalAddress}</small>
                      <p>{organization.legalAddress}</p>
                      <span>{t.contact.visitNote}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="site-footer meadow-footer">
        <div className="meadow-surface">
          <img
            className="meadow-background"
            src="/images/footer-meadow.webp"
            alt=""
            width="1536"
            height="1024"
            loading="lazy"
          />
          <div className="meadow-content">
            <div className="meadow-invitation" data-motion="copy">
              <h2>Вместе легче сделать шаг.</h2>
              <button
                className="meadow-action"
                onClick={() => openBooking()}
                aria-haspopup="dialog"
              >
                Давайте поговорим <ArrowUpRight size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="meadow-info" data-motion="copy">
              <div className="meadow-brand">
                <Brand footer />
                <p>{t.footer.tagline}</p>
              </div>
              <div className="meadow-contacts">
                <a href={`tel:${organization.phone}`}>
                  {organization.phoneDisplay}
                </a>
                <a href={`mailto:${organization.email}`}>
                  {organization.email}
                </a>
              </div>
              <nav className="meadow-links" aria-label="Навигация в подвале">
                {t.header.nav.map((item) => (
                  <a
                    key={item.id}
                    href={
                      item.id === "services" || item.id === "team"
                        ? `/${item.id}/`
                        : `/#${item.id}`
                    }
                  >
                    {item.label}
                  </a>
                ))}
                <a
                  href="#/privacy"
                  onClick={(e) => rememberContentOrigin(e.currentTarget)}
                >
                  {t.footer.privacy}
                </a>
              </nav>
            </div>
            <div className="meadow-legal">
              <span>
                © {new Date().getFullYear()} {organization.name}
              </span>
              <a
                href={organization.registryUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t.footer.registry}: {organization.registryCode}
              </a>
              <a href="#main">{t.common.backTop} ↑</a>
            </div>
            <div className="meadow-disclosure">
              <span>{t.footer.imageNote}</span>
              <span>{t.footer.prototype}</span>
            </div>
          </div>
        </div>
      </footer>

      <ContentDialog
        ref={contentDialog}
        contentKey={`${page}:${hash}`}
        closeLabel={t.common.close}
        open={
          !developmentNoticeOpen && (!!service || privacyOpen || unknownPage)
        }
        onClose={closeContent}
        title={
          service?.shortTitle ||
          (privacyOpen ? t.privacy.title : t.common.notFound)
        }
        className={service ? `service-detail theme-${service.theme}` : ""}
      >
        {service && (
          <>
            <ServiceArt type={service.icon} />
            <p className="detail-intro">{service.detail}</p>
            <h3>{t.details.forWhom}</h3>
            <p>{service.forWhom}</p>
            <h3>{t.details.includes}</h3>
            <ul className="detail-list">
              {service.includes.map((item) => (
                <li key={item}>
                  <Check size={17} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="detail-conditions">{t.details.conditions}</p>
            <div className="detail-actions">
              <button
                className="button button-dark"
                onClick={() =>
                  contentDialog.current?.close(() => bookFromService(service))
                }
              >
                {t.common.book}
                <ArrowUpRight size={18} />
              </button>
              <button
                className="button detail-services-button"
                onClick={() => contentDialog.current?.close(showAllServices)}
              >
                {t.common.allServices}
                <ArrowDown size={18} />
              </button>
            </div>
          </>
        )}
        {privacyOpen && t.privacy.paragraphs.map((p) => <p key={p}>{p}</p>)}
        {unknownPage && (
          <button
            className="button button-dark"
            onClick={() => contentDialog.current?.close()}
          >
            {t.common.back}
            <ArrowRight size={18} />
          </button>
        )}
      </ContentDialog>
      <BookingDialog
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        initialServiceId={bookingService}
        services={t.services.map((s) => ({ id: s.id, title: s.shortTitle }))}
        phone={organization.phone}
      />
      <AccessibilityWidget />
      {developmentNoticeOpen && (
        <DevelopmentNotice
          open={developmentNoticeOpen}
          onDismiss={() => setDevelopmentNoticeOpen(false)}
        />
      )}
    </div>
  );
}
