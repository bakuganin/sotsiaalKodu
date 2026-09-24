import { tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Users,
  House,
  Footprints,
  Clock3,
  HandHeart,
  Phone,
  Mail,
  CalendarDays,
  MapPin,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { getContent, organization } from "../content";
import "./support-invitation.css";

const icons = [MessageCircle, Users, House, Footprints, Clock3, HandHeart];
const contactCards = [
  { label: "Позвонить нам", Icon: Phone, href: `tel:${organization.phone}` },
  { label: "Написать нам", Icon: Mail, href: `mailto:${organization.email}` },
  { label: "Как встретиться", Icon: CalendarDays, href: "#contact-meeting" },
  { label: "Юридический адрес", Icon: MapPin, href: "#contact-address" },
  { label: "Наша команда", Icon: Users, href: "/team/" },
  { label: "Реквизиты компании", Icon: Building2, href: "/company/" },
];

export default function SupportInvitation({
  paused = false,
  variant = "values",
}: {
  paused?: boolean;
  variant?: "values" | "contact";
}) {
  const t = getContent();
  const scene = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const cards: { label: string; Icon: LucideIcon; href?: string }[] =
    variant === "contact"
      ? contactCards
      : t.contact.invitation.values.map((label, index) => ({
          label,
          Icon: icons[index],
        }));

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
      data-variant={variant}
      data-motion="copy"
      aria-labelledby="support-invitation-title"
    >
      <div className="support-world">
        <h2
          id="support-invitation-title"
          className="eyebrow support-world-kicker"
        >
          {variant === "contact"
            ? tr("ПРОСТРАНСТВО ДЛЯ ВАШЕЙ ИСТОРИИ")
            : t.contact.invitation.eyebrow}
        </h2>
        <div
          ref={scene}
          className="support-world-scene"
          data-floating={visible && !paused}
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
            loading={variant === "contact" ? "eager" : "lazy"}
          />
          <ul
            className="support-world-cards"
            aria-label={
              variant === "contact"
                ? tr("Контакты и полезные ссылки")
                : tr("Наш подход к поддержке")
            }
          >
            {cards.map(({ label, Icon, href }, index) => {
              const Surface = href ? "a" : "div";
              return (
                <li
                  className={`support-world-card support-world-card-${index + 1}`}
                  key={label}
                >
                  <Surface className="support-world-card-surface" href={href}>
                    <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
                    <span>{tr(label)}</span>
                  </Surface>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
