import { tr } from "../i18n";
import { ArrowDown, ArrowRight, Check } from "lucide-react";
import { getContent } from "../content";
import { serviceArtwork } from "../brand/serviceArtwork";
import {
  PageBookingButton,
  PageBreadcrumb,
  PageContact,
  type DetailPageProps,
} from "./PageParts";
import "./pages.css";

export default function ServicesPage({ onBook }: DetailPageProps) {
  const t = getContent();
  return (
    <div className="detail-page services-page">
      <div className="container">
        <PageBreadcrumb current={tr("Услуги")} />
        <section
          className="detail-page-intro"
          aria-labelledby="services-page-title"
        >
          <div data-motion="heading">
            <p className="detail-kicker">{tr("Четыре направления помощи")}</p>
            <h1 id="services-page-title">
              {tr("Поддержка, которая ")}
              <span>{tr("подходит вам")}</span>
            </h1>
          </div>
          <div
            className="detail-page-intro-aside"
            data-motion="copy"
            data-motion-delay="100"
          >
            <p>{t.servicesSection.description}</p>
            <a className="detail-text-link" href="/team/">
              {tr("Кто будет рядом")}
              <ArrowRight size={19} aria-hidden="true" />
            </a>
          </div>
        </section>

        <nav className="services-index" aria-label={tr("Направления помощи")}>
          {t.services.map((service, index) => (
            <a
              className="services-index-card"
              href={`#${service.id}`}
              key={service.id}
              data-motion="card"
              data-motion-delay={index * 70}
            >
              <span className="services-index-number">{service.number}</span>
              <img
                src={serviceArtwork[service.icon]}
                alt=""
                width={512}
                height={560}
              />
              <span className="services-index-label">
                <span>{service.shortTitle}</span>
                <ArrowDown size={22} aria-hidden="true" />
              </span>
            </a>
          ))}
        </nav>

        <div className="services-details">
          {t.services.map((service) => (
            <article
              className="services-detail"
              id={service.id}
              key={service.id}
              aria-labelledby={`service-title-${service.id}`}
            >
              <div
                className="services-detail-visual"
                aria-hidden="true"
                data-motion="object"
              >
                <span className="services-detail-number">{service.number}</span>
                <img
                  src={serviceArtwork[service.icon]}
                  alt=""
                  width={512}
                  height={560}
                  loading="lazy"
                />
                <span className="services-detail-category">
                  {service.category}
                </span>
              </div>
              <div className="services-detail-copy">
                <p className="detail-kicker">{service.category}</p>
                <h2 id={`service-title-${service.id}`} data-motion="heading">
                  {service.shortTitle}
                </h2>
                <p className="services-detail-lead" data-motion="copy">
                  {service.description}
                </p>
                <p data-motion="copy" data-motion-delay="70">
                  {service.detail}
                </p>
                <div className="services-detail-columns" data-motion="line">
                  <div>
                    <h3>{t.details.forWhom}</h3>
                    <p>{service.forWhom}</p>
                  </div>
                  <div>
                    <h3>{t.details.includes}</h3>
                    <ul>
                      {service.includes.map((item) => (
                        <li key={item}>
                          <Check size={18} aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="services-detail-bottom" data-motion="copy">
                  <PageBookingButton onClick={() => onBook(service.id)} />
                  <p className="detail-small-note">{t.details.conditions}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <PageContact onBook={onBook} />
      </div>
    </div>
  );
}
