import { useId, useState } from "react";
import { Plus } from "lucide-react";
import "./accordion.css";

type AnimatedAccordionProps = {
  items: readonly { title: string; text: string }[];
  variant: "process" | "faq";
  defaultOpenIndex?: number;
};

export function AnimatedAccordion({
  items,
  variant,
  defaultOpenIndex,
}: AnimatedAccordionProps) {
  const id = useId();
  const [openIndex, setOpenIndex] = useState<number | undefined>(
    defaultOpenIndex,
  );

  return (
    <div className={`${variant}-list animated-accordion`}>
      {items.map((item, index) => {
        const open = openIndex === index;
        const triggerId = `${id}-trigger-${index}`;
        const panelId = `${id}-panel-${index}`;

        return (
          <div
            className="accordion-item"
            data-open={open}
            key={item.title}
            data-motion="line"
            data-motion-delay={index * 65}
          >
            <h3 className="accordion-heading">
              <button
                className="accordion-trigger"
                type="button"
                id={triggerId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() =>
                  setOpenIndex((current) =>
                    current === index ? undefined : index,
                  )
                }
              >
                <span
                  className={
                    variant === "process" ? "step-number" : "faq-number"
                  }
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="accordion-title">{item.title}</span>
                <Plus
                  className="accordion-icon"
                  size={variant === "process" ? 19 : 20}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              className="accordion-panel"
              id={panelId}
              role="region"
              aria-labelledby={triggerId}
              aria-hidden={!open}
              inert={!open}
            >
              <div className="accordion-panel-inner">
                <p>{item.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
