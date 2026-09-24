import type { PointerEvent } from "react";
import {
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

function tiltCard(event: PointerEvent<HTMLLIElement>) {
  if (
    event.pointerType !== "mouse" ||
    !matchMedia("(hover: hover) and (pointer: fine)").matches ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.a11yReduceMotion === "true"
  )
    return;

  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = Math.max(
    -1,
    Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
  );
  const y = Math.max(
    -1,
    Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
  );
  card.style.setProperty("--card-rotate-x", `${-y * 8}deg`);
  card.style.setProperty("--card-rotate-y", `${x * 8}deg`);
  card.style.setProperty("--card-drift-x", `${x * 4}px`);
  card.style.setProperty("--card-drift-y", `${y * 3}px`);
}

function resetCard(event: PointerEvent<HTMLLIElement>) {
  for (const property of ["rotate-x", "rotate-y", "drift-x", "drift-y"])
    event.currentTarget.style.removeProperty(`--card-${property}`);
}

export default function SupportInvitation() {
  return (
    <div
      className="support-invitation"
      data-motion="copy"
      aria-labelledby="support-invitation-title"
    >
      <div className="support-world">
        <h2
          id="support-invitation-title"
          className="eyebrow support-world-kicker"
        >
          {t.contact.invitation.eyebrow}
        </h2>
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
                  onPointerMove={tiltCard}
                  onPointerLeave={resetCard}
                  onPointerCancel={resetCard}
                >
                  <div className="support-world-card-surface">
                    <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
