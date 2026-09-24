import { ArrowRight } from "lucide-react";
import { getContent } from "../content";
import { TeamGallery } from "../team/TeamSection";
import { PageBreadcrumb, PageContact, type DetailPageProps } from "./PageParts";
import "./pages.css";

const t = getContent();

export default function TeamPage({ onBook }: DetailPageProps) {
  return (
    <div className="detail-page people-page">
      <div className="container">
        <PageBreadcrumb current="Команда" />
        <section
          className="detail-page-intro"
          aria-labelledby="team-page-title"
        >
          <div data-motion="heading">
            <p className="detail-kicker">Люди, которые рядом</p>
            <h1 id="team-page-title">
              Люди, которым важно <span>ваше благополучие</span>
            </h1>
          </div>
          <div
            className="detail-page-intro-aside"
            data-motion="copy"
            data-motion-delay="100"
          >
            <p>{t.teamSection.description}</p>
            <a className="detail-text-link" href="/services/">
              Как мы можем помочь
              <ArrowRight size={19} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="people-team" aria-label="Команда Sotsiaal Kodu">
          <TeamGallery onBook={onBook} memberAnchors nameHeadingLevel={2} />
        </section>
        <section
          className="people-approach"
          aria-labelledby="people-approach-title"
        >
          <div data-motion="heading">
            <p className="detail-kicker">Что нас объединяет</p>
            <h2 id="people-approach-title">
              В основе заботы <span>внимание к человеку</span>
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
