import { tr, localize, getIntlLocale } from "../i18n";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  HandHeart,
  House,
  MessageCircle,
  Phone,
  X,
  type LucideIcon,
} from "lucide-react";
import { bookingRu } from "./ru";
import "./booking.css";

type Service = { id: string; title: string };
type BookingDialogProps = {
  open: boolean;
  onClose: () => void;
  initialServiceId?: string;
  services: Service[];
  phone: string;
};
type FieldErrors = { name?: string; contact?: string };

const DIALOG_TRANSITION_MS = 280;
const prefersLessMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.documentElement.dataset.a11yReduceMotion === "true";

const serviceIcons: Record<string, LucideIcon> = {
  counselling: MessageCircle,
  "support-person": HandHeart,
  courses: GraduationCap,
  "home-help": House,
};

const dateAtNoon = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day, 12));
const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const formatDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(getIntlLocale(), {
    ...options,
    timeZone: bookingRu.timeZone,
  }).format(date);
const todayInTallinn = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: bookingRu.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value);
  return dateAtNoon(part("year"), part("month") - 1, part("day"));
};

export default function BookingDialog({
  open,
  onClose,
  initialServiceId,
  services,
  phone,
}: BookingDialogProps) {
  const copy = localize(bookingRu);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const dateButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const previousOverflowRef = useRef<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [today, setToday] = useState(todayInTallinn);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [name, setName] = useState("");
  const [contactMethod, setContactMethod] = useState<"phone" | "email">(
    "phone",
  );
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [completed, setCompleted] = useState(false);
  const currentService = services.find((service) => service.id === serviceId);
  const visibleMonth = dateAtNoon(
    today.getUTCFullYear(),
    today.getUTCMonth() + monthOffset,
    1,
  );
  const monthDays = dateAtNoon(
    visibleMonth.getUTCFullYear(),
    visibleMonth.getUTCMonth() + 1,
    0,
  ).getUTCDate();
  const blankDays = (visibleMonth.getUTCDay() + 6) % 7;
  const selectedDateObject = selectedDate
    ? new Date(`${selectedDate}T12:00:00Z`)
    : undefined;
  const times =
    selectedDateObject && selectedDateObject.getUTCDate() % 2 === 0
      ? ["10:00", "14:30"]
      : ["09:30", "12:00", "15:30"];
  const available = (date: Date) =>
    dateKey(date) > dateKey(today) &&
    date.getUTCDay() !== 0 &&
    date.getUTCDay() !== 6;

  useEffect(() => {
    if (open) {
      setStep(0);
      setServiceId(initialServiceId ?? "");
      setToday(todayInTallinn());
      setMonthOffset(0);
      setSelectedDate("");
      setSelectedTime("");
      setName("");
      setContact("");
      setContactMethod("phone");
      setErrors({});
      setCompleted(false);
    }
  }, [open, initialServiceId]);

  const releaseDialog = useCallback(() => {
    dialogRef.current?.close();
    if (previousOverflowRef.current !== null) {
      document.body.style.overflow = previousOverflowRef.current;
      previousOverflowRef.current = null;
    }
    if (returnFocusRef.current?.isConnected)
      returnFocusRef.current.focus({ preventScroll: true });
    returnFocusRef.current = null;
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    let openingFrame: number | undefined;
    let closeTimer: number | undefined;
    const finishClose = () => {
      window.clearTimeout(closeTimer);
      releaseDialog();
      setName("");
      setContact("");
      setErrors({});
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (
        event.target === dialog &&
        event.propertyName === "opacity" &&
        event.pseudoElement === "" &&
        Number(getComputedStyle(dialog).opacity) === 0
      )
        finishClose();
    };

    if (open) {
      if (!dialog.open) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        previousOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.showModal();
        dialog.scrollTop = 0;
      }
      if (prefersLessMotion()) setVisible(true);
      else {
        // Paint the initial state before starting the entrance transition.
        openingFrame = requestAnimationFrame(() => {
          openingFrame = requestAnimationFrame(() => setVisible(true));
        });
      }
    } else {
      setVisible(false);
      if (dialog.open) {
        if (prefersLessMotion()) finishClose();
        else {
          // Keep the native modal and scroll lock until the exit is complete.
          dialog.addEventListener("transitionend", onTransitionEnd);
          closeTimer = window.setTimeout(
            finishClose,
            DIALOG_TRANSITION_MS + 50,
          );
        }
      }
    }

    return () => {
      if (openingFrame !== undefined) cancelAnimationFrame(openingFrame);
      window.clearTimeout(closeTimer);
      dialog.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [open, releaseDialog]);

  useEffect(() => releaseDialog, [releaseDialog]);

  useEffect(() => {
    if (open) {
      if (dialogRef.current) dialogRef.current.scrollTop = 0;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [step, completed, open]);

  const close = () => onClose();

  const selectDay = (date: Date) => {
    setSelectedDate(dateKey(date));
    setSelectedTime("");
  };

  const moveCalendarFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    date: Date,
  ) => {
    const shift = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
      event.key
    ];
    if (shift === undefined) return;
    event.preventDefault();
    const target = new Date(date);
    target.setUTCDate(target.getUTCDate() + shift);
    for (let attempt = 0; attempt < 7 && !available(target); attempt += 1) {
      target.setUTCDate(target.getUTCDate() + (shift < 0 ? -1 : 1));
    }
    const targetOffset =
      (target.getUTCFullYear() - today.getUTCFullYear()) * 12 +
      target.getUTCMonth() -
      today.getUTCMonth();
    if (targetOffset < 0 || targetOffset > 2 || !available(target)) return;
    setMonthOffset(targetOffset);
    requestAnimationFrame(() =>
      dateButtons.current.get(dateKey(target))?.focus(),
    );
  };

  const submitPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (name.trim().length < 2 || name.trim().length > 80)
      nextErrors.name = copy.nameError;
    const trimmedContact = contact.trim();
    if (contactMethod === "email") {
      if (
        trimmedContact.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact)
      )
        nextErrors.contact = copy.emailError;
    } else {
      const digits = trimmedContact.replace(/\D/g, "");
      if (
        !/^\+?[\d\s().-]+$/.test(trimmedContact) ||
        digits.length < 7 ||
        digits.length > 15
      )
        nextErrors.contact = copy.phoneError;
    }
    setErrors(nextErrors);
    if (nextErrors.name) nameRef.current?.focus();
    else if (nextErrors.contact) contactRef.current?.focus();
    else setCompleted(true);
  };

  return (
    <dialog
      ref={dialogRef}
      className="booking-dialog"
      data-visible={visible}
      aria-labelledby="booking-title"
      aria-describedby="booking-demo-notice"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
    >
      <div className="booking-shell">
        <button
          type="button"
          className="booking-close"
          aria-label={copy.close}
          onClick={close}
        >
          <X size={22} aria-hidden="true" />
        </button>
        <p className="booking-eyebrow">
          <span aria-hidden="true" />
          {copy.eyebrow}
        </p>
        <p className="booking-demo-note" id="booking-demo-notice">
          {copy.demoNotice}
        </p>
        {!completed && (
          <ol className="booking-steps" aria-label={copy.stepsLabel}>
            {copy.steps.map((label, index) => (
              <li
                key={label}
                aria-current={step === index ? "step" : undefined}
                className={index <= step ? "is-active" : ""}
              >
                <span aria-hidden="true">
                  {index < step ? <Check size={14} /> : index + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        )}
        <h2
          ref={headingRef}
          tabIndex={-1}
          id="booking-title"
          className="booking-title"
        >
          {completed ? copy.resultHeading : copy.headings[step]}
        </h2>
        {!completed && (
          <p className="booking-description">{copy.descriptions[step]}</p>
        )}

        {!completed && step === 0 && (
          <>
            <fieldset className="booking-services">
              <legend className="booking-sr-only">{copy.serviceGroup}</legend>
              {services.map((service) => {
                const ServiceIcon = serviceIcons[service.id] ?? HandHeart;
                return (
                  <label
                    className={`booking-service ${serviceId === service.id ? "is-selected" : ""}`}
                    key={service.id}
                  >
                    <input
                      type="radio"
                      name="booking-service"
                      value={service.id}
                      checked={serviceId === service.id}
                      onChange={() => setServiceId(service.id)}
                    />
                    <span className="booking-service-icon" aria-hidden="true">
                      <ServiceIcon size={22} strokeWidth={1.75} />
                    </span>
                    <span>{service.title}</span>
                    <span className="booking-radio-mark" aria-hidden="true">
                      {serviceId === service.id && <Check size={13} />}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="booking-actions booking-actions-end">
              <button
                type="button"
                className="booking-primary"
                disabled={!currentService}
                onClick={() => setStep(1)}
              >
                {copy.next}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {!completed && step === 1 && (
          <>
            <div className="booking-date-layout">
              <section
                className="booking-calendar"
                aria-label={copy.calendarLabel}
              >
                <div className="booking-month-nav">
                  <button
                    type="button"
                    aria-label={copy.previousMonth}
                    disabled={monthOffset === 0}
                    onClick={() => setMonthOffset((value) => value - 1)}
                  >
                    <ChevronLeft size={20} aria-hidden="true" />
                  </button>
                  <h3 aria-live="polite">
                    {formatDate(visibleMonth, {
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                  <button
                    type="button"
                    aria-label={copy.nextMonth}
                    disabled={monthOffset === 2}
                    onClick={() => setMonthOffset((value) => value + 1)}
                  >
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                </div>
                <div className="booking-calendar-grid">
                  {copy.weekdays.map((day, index) => (
                    <span
                      key={day}
                      className="booking-weekday"
                      aria-label={copy.weekdaysFull[index]}
                    >
                      {day}
                    </span>
                  ))}
                  {Array.from({ length: blankDays }, (_, index) => (
                    <span key={`blank-${index}`} aria-hidden="true" />
                  ))}
                  {Array.from({ length: monthDays }, (_, index) => {
                    const date = dateAtNoon(
                      visibleMonth.getUTCFullYear(),
                      visibleMonth.getUTCMonth(),
                      index + 1,
                    );
                    const key = dateKey(date);
                    return (
                      <button
                        type="button"
                        key={key}
                        ref={(node) => {
                          if (node) dateButtons.current.set(key, node);
                          else dateButtons.current.delete(key);
                        }}
                        className={`booking-day ${selectedDate === key ? "is-selected" : ""}`}
                        disabled={!available(date)}
                        aria-label={formatDate(date, {
                          day: "numeric",
                          month: "long",
                          weekday: "long",
                          year: "numeric",
                        })}
                        aria-pressed={selectedDate === key}
                        onClick={() => selectDay(date)}
                        onKeyDown={(event) => moveCalendarFocus(event, date)}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <p className="booking-calendar-help">{copy.calendarHelp}</p>
              </section>
              <section
                className="booking-time-panel"
                aria-labelledby="booking-time-title"
              >
                <Clock3 size={22} aria-hidden="true" />
                <h3 id="booking-time-title">
                  {selectedDateObject ? copy.sampleTimes : copy.chooseDay}
                </h3>
                <p className="booking-selected-day" aria-live="polite">
                  {selectedDateObject
                    ? formatDate(selectedDateObject, {
                        day: "numeric",
                        month: "long",
                        weekday: "long",
                      })
                    : copy.noDay}
                </p>
                {selectedDate && (
                  <fieldset className="booking-times">
                    <legend className="booking-sr-only">
                      {copy.timeGroup}
                    </legend>
                    {times.map((time) => (
                      <label
                        key={time}
                        className={selectedTime === time ? "is-selected" : ""}
                      >
                        <input
                          type="radio"
                          name="booking-time"
                          value={time}
                          checked={selectedTime === time}
                          onChange={() => setSelectedTime(time)}
                          aria-label={`${time}${copy.demoTimeSuffix}`}
                        />
                        <span className="booking-time-value">
                          {time}
                          {selectedTime === time && (
                            <Check
                              className="booking-time-check"
                              size={14}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <p className="booking-time-zone">{copy.timeLabel}</p>
              </section>
            </div>
            <div className="booking-actions">
              <button
                type="button"
                className="booking-back"
                onClick={() => setStep(0)}
              >
                <ArrowLeft size={17} aria-hidden="true" />
                {copy.back}
              </button>
              <button
                type="button"
                className="booking-primary"
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(2)}
              >
                {copy.next}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {!completed && step === 2 && (
          <form
            className="booking-contact-form"
            noValidate
            onSubmit={submitPreview}
          >
            <div className="booking-mini-summary">
              <CalendarDays size={19} aria-hidden="true" />
              <span>
                {currentService?.title}
                <small>
                  {selectedDateObject &&
                    formatDate(selectedDateObject, {
                      day: "numeric",
                      month: "long",
                    })}{" "}
                  · {selectedTime} · {bookingRu.timeZone}
                </small>
              </span>
            </div>
            <div className="booking-field">
              <label htmlFor="booking-name">{copy.nameLabel}</label>
              <input
                ref={nameRef}
                id="booking-name"
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={copy.namePlaceholder}
                maxLength={80}
                required
                aria-invalid={Boolean(errors.name)}
                aria-describedby={
                  errors.name ? "booking-name-error" : undefined
                }
              />
              {errors.name && (
                <p
                  className="booking-error"
                  id="booking-name-error"
                  role="alert"
                >
                  {errors.name}
                </p>
              )}
            </div>
            <fieldset className="booking-contact-method">
              <legend>{copy.contactMethod}</legend>
              <div>
                {(["phone", "email"] as const).map((method) => (
                  <label
                    key={method}
                    className={contactMethod === method ? "is-selected" : ""}
                  >
                    <input
                      type="radio"
                      name="booking-contact-method"
                      checked={contactMethod === method}
                      onChange={() => {
                        setContactMethod(method);
                        setContact("");
                        setErrors((previous) => ({ name: previous.name }));
                      }}
                    />
                    {method === "phone" ? copy.byPhone : copy.byEmail}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="booking-field">
              <label htmlFor="booking-contact">
                {contactMethod === "phone" ? copy.phoneLabel : copy.emailLabel}
              </label>
              <input
                ref={contactRef}
                id="booking-contact"
                type={contactMethod === "phone" ? "tel" : "email"}
                autoComplete="off"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder={
                  contactMethod === "phone"
                    ? copy.phonePlaceholder
                    : copy.emailPlaceholder
                }
                maxLength={contactMethod === "phone" ? 30 : 254}
                required
                aria-invalid={Boolean(errors.contact)}
                aria-describedby={
                  errors.contact
                    ? "booking-contact-error booking-privacy"
                    : "booking-privacy"
                }
              />
              {errors.contact && (
                <p
                  className="booking-error"
                  id="booking-contact-error"
                  role="alert"
                >
                  {errors.contact}
                </p>
              )}
            </div>
            <p className="booking-privacy" id="booking-privacy">
              {copy.contactPrivacy}{" "}
              <a href="/privacy/" target="_blank" rel="noreferrer">
                {tr("Политика конфиденциальности (в новой вкладке)")}
              </a>
            </p>
            <div className="booking-actions">
              <button
                type="button"
                className="booking-back"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={17} aria-hidden="true" />
                {copy.back}
              </button>
              <button type="submit" className="booking-primary">
                {copy.check}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
        )}

        {completed && (
          <div className="booking-result">
            <p className="booking-result-notice" role="status">
              {copy.resultNotice}
            </p>
            <dl className="booking-result-details">
              <div>
                <dt>{copy.service}</dt>
                <dd>{currentService?.title}</dd>
              </div>
              <div>
                <dt>{copy.date}</dt>
                <dd>
                  {selectedDateObject &&
                    formatDate(selectedDateObject, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                </dd>
              </div>
              <div>
                <dt>{copy.time}</dt>
                <dd>
                  {selectedTime} · {bookingRu.timeZone}
                </dd>
              </div>
              <div>
                <dt>{copy.contact}</dt>
                <dd>
                  {name.trim()} · {contact.trim()}
                </dd>
              </div>
            </dl>
            {phone && (
              <div className="booking-real-contact">
                <p>{copy.realContact}</p>
                <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>
                  <Phone size={17} aria-hidden="true" />
                  {copy.call}: {phone}
                </a>
              </div>
            )}
            <button
              type="button"
              className="booking-primary booking-finish"
              onClick={close}
            >
              {copy.done}
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
