import {
  ArrowRight,
  MessageCircle,
  Users,
  House,
  Footprints,
  Clock3,
  HandHeart,
} from "lucide-react";
import { getContent } from "../content";
import "./support-invitation.css";

const t = getContent();
const icons = [MessageCircle, Users, House, Footprints, Clock3, HandHeart];

export default function SupportInvitation({ onBook }: { onBook: () => void }) {
  return (
    <div
      className="support-invitation"
      data-motion="pair"
      aria-labelledby="support-invitation-title"
    >
      <div className="support-world">
        <p className="eyebrow support-world-kicker">
          {t.contact.invitation.eyebrow}
        </p>
        <div className="support-world-scene">
          <p className="support-world-word" aria-hidden="true">
            ОПОРА
          </p>
          <img
            className="support-world-image"
            src="/images/contact-moss-world.webp"
            alt=""
            width="960"
            height="960"
            loading="lazy"
          />
          <ul
            className="support-world-cards"
            aria-label="Наш подход к поддержке"
          >
            {t.contact.invitation.values.map((label, index) => {
              const Icon = icons[index];
              return (
                <li
                  className={`support-world-card support-world-card-${index + 1}`}
                  key={label}
                >
                  <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="support-invitation-copy">
        <div>
          <h2 id="support-invitation-title">{t.contact.invitation.title}</h2>
          <p>{t.contact.description}</p>
        </div>
        <div className="support-invitation-action">
          <button
            className="pill-button"
            type="button"
            onClick={onBook}
            aria-haspopup="dialog"
          >
            <span>{t.common.book}</span>
            <span className="pill-arrow">
              <ArrowRight size={23} aria-hidden="true" />
            </span>
          </button>
          <p className="booking-note">{t.contact.bookNote}</p>
        </div>
      </div>
    </div>
  );
}
