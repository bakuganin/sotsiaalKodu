import { useEffect, useRef, useState, type PointerEvent } from "react";
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

function moveCards(event: PointerEvent<HTMLDivElement>) {
  if (
    event.pointerType !== "mouse" ||
    event.currentTarget.dataset.floating !== "true" ||
    !matchMedia("(hover: hover) and (pointer: fine)").matches ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.a11yReduceMotion === "true"
  )
    return;

  const scene = event.currentTarget;
  const bounds = scene.getBoundingClientRect();
  const x = Math.max(
    -1,
    Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
  );
  const y = Math.max(
    -1,
    Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
  );
  scene.style.setProperty("--cards-x", `${x * 10}px`);
  scene.style.setProperty("--cards-y", `${y * 7}px`);
}

function resetCards(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.removeProperty("--cards-x");
  event.currentTarget.style.removeProperty("--cards-y");
}

export default function SupportInvitation({
  paused = false,
}: {
  paused?: boolean;
}) {
  const scene = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = scene.current;
    if (!element) return;
    let inView = false;
    const refresh = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      refresh();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

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
        <div
          ref={scene}
          className="support-world-scene"
          data-floating={visible && !paused}
          onPointerMove={moveCards}
          onPointerLeave={resetCards}
          onPointerCancel={resetCards}
        >
          <p className="support-world-word" aria-hidden="true">
            <span>SOTSIAAL</span> <span>KODU</span>
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
