// `align="left"` + `action` together produce the "[Heading]  ...  [View All →]" header row
// needed on rows that pair a heading with a link: heading and action are independent flex
// siblings (each free to wrap/shrink on its own) instead of a `position:absolute` link stacked
// on top of a centered, possibly multi-line heading, which is what let View All visually
// collide with long/wrapped titles on narrow screens. Every caller that omits these two props
// still gets the plain centered layout, unaffected.
//
// The heading itself now always uses the shared `.section-title` typography class (Copperplate
// Gothic Bold, falling back to Cinzel - see index.css) instead of font-display, per the
// requirement that major section headings (Featured Categories, Sales & Offers, Customer
// Reviews, You May Also Like, Custom Orders, etc. - this component is reused across all of
// them) share one consistent, bold heading style. Body copy (the optional subtitle) is
// untouched - only the heading font changed, never the readable body text.
export default function SectionHeading({ eyebrow, title, subtitle, light, align = "center", action }) {
  const isLeft = align === "left";
  return (
    <div className={`mb-8 sm:mb-10 ${light ? "text-cream" : ""}`}>
      <div className={isLeft ? "flex flex-wrap items-start justify-between gap-x-4 gap-y-2" : "text-center"}>
        <div className={isLeft ? "flex-1 min-w-[60%]" : ""}>
          {eyebrow && <div className={`section-eyebrow mb-2 ${light ? "text-gold" : "text-rose"}`}>{eyebrow}</div>}
          <h2 className={`section-title break-words ${light ? "text-cream" : "text-plum dark:text-cream"}`}>{title}</h2>
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      <div className="floral-divider mt-4 mb-3">❀</div>
      {subtitle && (
        <p className={`text-sm max-w-xl ${isLeft ? "" : "mx-auto"} ${light ? "text-cream/70" : "text-plum-light/80 dark:text-cream/80"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
