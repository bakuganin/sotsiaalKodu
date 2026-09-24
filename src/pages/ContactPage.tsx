import { tr } from "../i18n";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { getContent, organization } from "../content";
import SupportInvitation from "../contact/SupportInvitation";
import { PageBreadcrumb } from "./PageParts";
import "./pages.css";
import "./contact-page.css";

export default function ContactPage({ paused }: { paused: boolean }) {
  const t = getContent();
  return (
    <div className="contact-page">
      <div className="container">
        <PageBreadcrumb current={tr("Контакты")} />
        <section
          className="contact-page-intro"
          aria-labelledby="contact-page-title"
        >
          <div data-motion="heading">
            <p className="eyebrow">{tr("Контакты")}</p>
            <h1 id="contact-page-title">
              {tr("Мы ")}
              <span>{tr("на связи")}</span>
            </h1>
          </div>
          <div className="contact-page-intro-copy" data-motion="copy">
            <p>
              {tr(
                "Можно начать с простого разговора. Расскажите о себе или близком человеке — вместе найдём следующий шаг.",
              )}
            </p>
            <a href="#contact-details">
              {tr("Выбрать способ связи ")}
              <ArrowDown size={18} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>

      <SupportInvitation paused={paused} variant="contact" />

      <section
        id="contact-details"
        className="contact-page-details container"
        aria-labelledby="contact-details-title"
      >
        <div className="contact-page-panel">
          <div className="contact-page-direct" data-motion="copy">
            <p className="eyebrow">{tr("Начать разговор")}</p>
            <h2 id="contact-details-title">
              {tr("Позвоните")}
              <br />
              {tr("или напишите")}
            </h2>
            <p className="contact-page-note">
              {tr(
                "Не обязательно заранее знать, какая помощь нужна. Мы поможем разобраться.",
              )}
            </p>
            <a
              className="contact-page-method"
              href={`tel:${organization.phone}`}
            >
              <Phone size={23} aria-hidden="true" />
              <span>
                <small>{tr("Телефон")}</small>
                <strong>{organization.phoneDisplay}</strong>
              </span>
              <ArrowUpRight size={21} aria-hidden="true" />
            </a>
            <a
              className="contact-page-method"
              href={`mailto:${organization.email}`}
            >
              <Mail size={23} aria-hidden="true" />
              <span>
                <small>{tr("Электронная почта")}</small>
                <strong>{organization.email}</strong>
              </span>
              <ArrowUpRight size={21} aria-hidden="true" />
            </a>
          </div>
          <div className="contact-page-practical" data-motion="copy">
            <div id="contact-meeting" className="contact-page-info">
              <CalendarDays size={25} aria-hidden="true" />
              <h2>{tr("Встреча в вашем ритме")}</h2>
              <p>
                {tr(
                  "Свяжитесь с нами, чтобы обсудить удобное время и формат встречи.",
                )}{" "}
                {t.contact.visitNote}
              </p>
            </div>
            <div id="contact-address" className="contact-page-info">
              <MapPin size={25} aria-hidden="true" />
              <h2>{t.contact.legalAddress}</h2>
              <address>{tr(organization.legalAddress)}</address>
              <p>
                {tr(
                  "Это адрес регистрации компании. Для встречи, пожалуйста, сначала позвоните или напишите нам.",
                )}
              </p>
            </div>
          </div>
          <div className="contact-page-company">
            <p>
              {organization.name}
              <span>
                {tr("Регистрационный код ")}
                {organization.registryCode}
              </span>
            </p>
            <a href="/company/">
              {tr("Реквизиты компании ")}
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
        <p className="contact-page-privacy">
          {tr("О том, как мы обрабатываем обращения, читайте в")}{" "}
          <a href="/privacy/">{tr("политике конфиденциальности")}</a>.
        </p>
      </section>
    </div>
  );
}
