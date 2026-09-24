import { tr } from "../i18n";
import { ArrowRight } from "lucide-react";
import { getContent } from "../content";
import { TeamGallery } from "../team/TeamSection";
import { PageBreadcrumb, PageContact, type DetailPageProps } from "./PageParts";
import "./pages.css";

export default function TeamPage({ onBook }: DetailPageProps) {
  const t = getContent();
  return (
    <div className="detail-page people-page">
      <div className="container">
        <PageBreadcrumb current={tr("Команда")} />
        <section
          className="detail-page-intro"
          aria-labelledby="team-page-title"
        >
          <div data-motion="heading">
            <p className="detail-kicker">{tr("Люди, которые рядом")}</p>
            <h1 id="team-page-title">
              {tr("Люди, которым важно ")}
              <span>{tr("ваше благополучие")}</span>
            </h1>
          </div>
          <div
            className="detail-page-intro-aside"
            data-motion="copy"
            data-motion-delay="100"
          >
            <p>{t.teamSection.description}</p>
            <a className="detail-text-link" href="/services/">
              {tr("Как мы можем помочь")}
              <ArrowRight size={19} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section
          className="people-team"
          aria-label={tr("Команда Sotsiaal Kodu")}
        >
          <TeamGallery onBook={onBook} memberAnchors nameHeadingLevel={2} />
        </section>
        <section
          className="people-approach"
          aria-labelledby="people-approach-title"
        >
          <div data-motion="heading">
            <p className="detail-kicker">{tr("Что нас объединяет")}</p>
            <h2 id="people-approach-title">
              {tr("В основе заботы ")}
              <span>{tr("внимание к человеку")}</span>
            </h2>
            <p>{t.teamSection.profileText}</p>
          </div>
          <div className="people-principles">
            {t.about.values.map((value, index) => (
              <div
                className="people-principle"
                key={value.title}
                data-motion="line"
                data-motion-delay={index * 70}
              >
                <span aria-hidden="true">0{index + 1}</span>
                <div>
                  <h3>{value.title}</h3>
                  <p>{value.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <p className="people-growing-note" data-motion="line">
          {t.teamSection.teamNote}
        </p>
        <PageContact onBook={onBook} />
      </div>
    </div>
  );
}
