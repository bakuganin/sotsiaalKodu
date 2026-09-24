import { tr } from "../i18n";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { getContent } from "../content";

export type DetailPageProps = {
  onBook: (serviceId?: string) => void;
};

export function PageBreadcrumb({ current }: { current: string }) {
  return (
    <nav
      className="detail-breadcrumb"
      aria-label={tr("Хлебные крошки")}
      data-motion="copy"
    >
      <a href="/">{tr("Главная")}</a>
      <ChevronRight size={14} aria-hidden="true" />
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export function PageBookingButton({ onClick }: { onClick: () => void }) {
  const t = getContent();
  return (
    <button type="button" className="button button-dark" onClick={onClick}>
      {t.common.book}
      <ArrowUpRight size={20} aria-hidden="true" />
    </button>
  );
}

export function PageContact({ onBook }: DetailPageProps) {
  const t = getContent();
  return (
    <section
      className="detail-contact"
      aria-labelledby="detail-contact-title"
      data-motion="pair"
    >
      <div className="detail-contact-copy">
        <p className="detail-kicker">{tr("Первый шаг — в вашем ритме")}</p>
        <h2 id="detail-contact-title">
          {tr("Начнём ")}
          <span>{tr("с разговора")}</span>
        </h2>
        <p>
          {tr(
            "Не обязательно знать, какая помощь вам нужна. Расскажите о своей ситуации — вместе обсудим подходящий следующий шаг.",
          )}
        </p>
      </div>
      <div className="detail-contact-actions">
        <PageBookingButton onClick={() => onBook()} />
        <button
          type="button"
          className="detail-text-link"
          onClick={() => onBook()}
          aria-haspopup="dialog"
        >
          {t.calm.write}
          <ArrowRight size={19} aria-hidden="true" />
        </button>
        <p className="detail-small-note">{t.contact.bookNote}</p>
      </div>
    </section>
  );
}
