import { useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Sprout,
  CalendarDays,
} from "lucide-react";
import { getContent } from "../content";
import "./process.css";

const t = getContent();
const icons = [MessageCircle, Sprout, CalendarDays];
const artwork = [
  { cover: "forest", detail: "conversation" },
  { cover: "support-cover", detail: "support-detail" },
  { cover: "meeting-cover", detail: "meeting-detail" },
];

export default function ProcessSection({ onBook }: { onBook: () => void }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = t.process.steps.length;
  const select = (index: number) => setActive((index + count) % count);

  function handleTabKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % count;
    else if (event.key === "ArrowLeft") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      className="process-showcase container"
      aria-labelledby="process-title"
    >
      <p className="eyebrow process-showcase-label">
        {t.process.presentation.eyebrow}
      </p>
      <div className="process-spread">
        <div className="process-cover">
          {artwork.map(({ cover }, index) => (
            <img
              key={cover}
              className="process-cover-image"
              data-active={active === index}
              src={`/images/process/${cover}.webp`}
              alt=""
              width="960"
              height="1280"
              loading="lazy"
            />
          ))}
          <div className="process-cover-copy">
            <h2 id="process-title">{t.process.presentation.title}</h2>
            <p>{t.process.presentation.description}</p>
          </div>
          <div className="process-controls">
            <button
              type="button"
              aria-label="Предыдущий шаг"
              onClick={() => select(active - 1)}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Следующий шаг"
              onClick={() => select(active + 1)}
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <span aria-hidden="true">
              0{active + 1} / 0{count}
            </span>
          </div>
        </div>
        <div className="process-guide">
          <div
            className="process-tabs"
            role="tablist"
            aria-label="Шаги обращения"
          >
            {t.process.presentation.tabs.map((label, index) => {
              const Icon = icons[index];
              return (
                <button
                  key={label}
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`process-tab-${index}`}
                  aria-controls={`process-panel-${index}`}
                  aria-selected={active === index}
                  tabIndex={active === index ? 0 : -1}
                  onClick={() => select(index)}
                  onKeyDown={(event) => handleTabKey(event, index)}
                >
                  {label}
                  <Icon size={15} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div className="process-conversation" aria-hidden="true">
            {artwork.map(({ detail }, index) => (
              <img
                key={detail}
                className="process-detail-image"
                data-active={active === index}
                src={`/images/process/${detail}.webp`}
                alt=""
                width="512"
                height="512"
                loading="lazy"
              />
            ))}
          </div>
          <div className="process-panels">
            {t.process.steps.map((step, index) => (
              <div
                key={step.title}
                id={`process-panel-${index}`}
                className="process-step-panel"
                role="tabpanel"
                aria-labelledby={`process-tab-${index}`}
                data-active={active === index}
                aria-hidden={active !== index}
                inert={active !== index}
                tabIndex={active === index ? 0 : -1}
              >
                <p className="process-step-caption">Шаг 0{index + 1}</p>
                <h3>{step.title}</h3>
                <p className="process-step-description">{step.text}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="process-start"
            onClick={onBook}
            aria-haspopup="dialog"
          >
            <span>{t.process.presentation.action}</span>
            <span className="process-start-arrow">
              <ArrowRight size={18} aria-hidden="true" />
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
