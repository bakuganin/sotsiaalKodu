import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight, BookOpen, Flower2, Plus, Scale } from "lucide-react";
import { getContent } from "../content";
import "./team.css";

const t = getContent();

type TeamGalleryProps = {
  onBook: () => void;
  memberAnchors?: boolean;
  nameHeadingLevel?: 2 | 3;
};

export function TeamGallery({
  onBook,
  memberAnchors = false,
  nameHeadingLevel = 3,
}: TeamGalleryProps) {
  const NameHeading = nameHeadingLevel === 2 ? "h2" : "h3";
  const [activeId, setActiveId] = useState<string>(() => {
    const member = memberAnchors
      ? t.team.find((person) => `#${person.id}` === window.location.hash)
      : undefined;
    return member?.id ?? t.team[0].id;
  });
  const galleryRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!memberAnchors) return;
    const selectLinkedMember = () => {
      const member = t.team.find(
        (person) => `#${person.id}` === window.location.hash,
      );
      if (member) setActiveId(member.id);
    };
    window.addEventListener("hashchange", selectLinkedMember);
    window.addEventListener("popstate", selectLinkedMember);
    return () => {
      window.removeEventListener("hashchange", selectLinkedMember);
      window.removeEventListener("popstate", selectLinkedMember);
    };
  }, [memberAnchors]);

  useLayoutEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery || typeof ResizeObserver === "undefined") return;
    const contents = gallery.querySelectorAll<HTMLElement>(
      ".team-profile-content",
    );
    // Both biographies reserve the same space while the accordion switches.
    const updateHeight = () => {
      const height = Math.max(
        ...Array.from(contents, (content) => content.offsetHeight),
      );
      gallery.style.setProperty(
        "--team-profile-height",
        `${Math.ceil(height)}px`,
      );
    };
    const observer = new ResizeObserver(updateHeight);
    contents.forEach((content) => observer.observe(content));
    updateHeight();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="team-gallery"
      data-motion="card"
      ref={galleryRef}
      style={{ "--team-count": t.team.length } as CSSProperties}
    >
      {t.team.map((member, index) => {
        const active = activeId === member.id;
        return (
          <article
            id={memberAnchors ? member.id : undefined}
            className={`team-card team-${member.id}`}
            data-active={active}
            key={member.id}
          >
            <button
              type="button"
              className="team-portrait"
              aria-label={member.name}
              aria-expanded={active}
              aria-controls={`team-panel-${member.id}`}
              onClick={() => setActiveId(member.id)}
            >
              <img
                className="team-photo"
                src={member.photo}
                alt=""
                width={member.photoWidth}
                height={member.photoHeight}
                loading="lazy"
              />
              <span className="team-portrait-shade" aria-hidden="true" />
              <span className="team-portrait-index" aria-hidden="true">
                0{index + 1}
              </span>
              <span className="team-person-caption" aria-hidden={!active}>
                <NameHeading>{member.name}</NameHeading>
                <span className="team-person-role">{t.teamSection.role}</span>
              </span>
              <span className="team-compact-name" aria-hidden="true">
                {member.name}
              </span>
              <span className="team-open-mark" aria-hidden="true">
                <Plus size={18} />
              </span>
            </button>
            <div className="team-profile-clip">
              <div
                id={`team-panel-${member.id}`}
                className="team-profile"
                aria-hidden={!active}
                inert={!active}
                role="region"
                aria-label={member.name}
              >
                <div className="team-profile-inner">
                  <div className="team-profile-content">
                    <div className="team-profile-top">
                      <span>{t.teamSection.role}</span>
                    </div>
                    <div className="team-profile-qualification">
                      {member.id === "natalia" ? (
                        <BookOpen size={21} aria-hidden="true" />
                      ) : (
                        <Scale size={21} aria-hidden="true" />
                      )}
                      <span>{member.profile.qualification}</span>
                    </div>
                    <p className="team-profile-kicker">
                      {member.profile.kicker}
                    </p>
                    <p className="team-profile-lead">{member.profile.lead}</p>
                    <p className="team-profile-description">
                      {member.profile.description}
                    </p>
                    <dl className="team-profile-facts">
                      {member.profile.facts.map((fact) => (
                        <div key={fact.label}>
                          <dt>{fact.label}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="team-profile-bottom">
                      <span className="team-topics-label">
                        {t.teamSection.expertiseLabel}
                      </span>
                      <ul className="team-topics">
                        {member.profile.topics.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        className="team-contact-link"
                        onClick={() => onBook()}
                        aria-haspopup="dialog"
                      >
                        {t.teamSection.contact}
                        <ArrowUpRight size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function TeamSection() {
  return (
    <section id="team" className="team-preview" aria-labelledby="team-title">
      <div className="container team-preview-layout">
        <div data-motion="heading">
          <p className="team-eyebrow">
            <Flower2 size={14} aria-hidden="true" />
            {t.teamPreview.eyebrow}
          </p>
          <h2 id="team-title">{t.teamPreview.title}</h2>
          <a className="pill-button" href="/team/">
            <span>{t.teamPreview.action}</span>
            <span className="pill-arrow">
              <ArrowUpRight size={22} aria-hidden="true" />
            </span>
          </a>
        </div>
        <div className="team-preview-details" data-motion="copy">
          <p className="team-preview-lead">{t.teamPreview.description}</p>
          <ul className="team-preview-topics">
            {t.teamPreview.topics.map((topic, index) => (
              <li key={topic.title}>
                <span className="team-preview-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <div>
                  <h3>{topic.title}</h3>
                  <p>{topic.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
