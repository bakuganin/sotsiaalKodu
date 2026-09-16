type SectionIconVariant = "support" | "services" | "care" | "contact";

export default function SectionIcon({
  variant,
}: {
  variant: SectionIconVariant;
}) {
  return (
    <img
      className="section-mark"
      src={`/images/section-icons/${variant}.webp`}
      alt=""
      aria-hidden="true"
      width={111}
      height={111}
      loading="lazy"
      decoding="async"
    />
  );
}
