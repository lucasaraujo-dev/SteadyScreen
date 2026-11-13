"use client";

import { useLayoutEffect, useRef, useState } from "react";

const TAB_H = 44; // tab height
const R = 28; // card corners
const r = 16; // tab's top corners
const c = 16; // concave curves joining the tab to the card
const TAB_PAD = 26; // space each side of the title

/**
 * A glass card with its title in a tab on top, merged into one shape (like
 * the room chat). The card is see-through glass, so the tab and the body
 * can't be two overlapping boxes: the outline is drawn as a single SVG path
 * that follows the card's size and the title's width.
 */
export default function TabCard({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, tab: 0 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const head = titleRef.current;
    if (!box || !head) return;
    const measure = () =>
      setSize({
        w: box.offsetWidth,
        h: box.offsetHeight,
        tab: Math.ceil(head.scrollWidth) + TAB_PAD * 2,
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(head);
    return () => ro.disconnect();
  }, [title]);

  const d = size.w
    ? shape(size.w, size.h, Math.min(size.tab, size.w - 2 * (R + c)))
    : "";

  return (
    <div ref={boxRef} className={`tab-card ${className}`}>
      <svg
        className="tab-card-shape"
        width={size.w}
        height={size.h}
        aria-hidden
      >
        {/* Same path in the CSS `d` property so a new title springs the tab. */}
        <path d={d} style={{ d: d ? `path("${d}")` : undefined }} />
      </svg>
      <h2 ref={titleRef} className="tab-card-title" style={{ height: TAB_H }}>
        {title}
      </h2>
      <div className="tab-card-body">{children}</div>
    </div>
  );
}

/** Card outline: rounded box starting at TAB_H, a centered tab on top. */
function shape(w: number, h: number, tab: number): string {
  const x0 = (w - tab) / 2;
  const x1 = x0 + tab;
  const t = TAB_H;
  const n = (v: number) => Math.round(v * 10) / 10;
  return [
    `M${R} ${t}`,
    `H${n(x0 - c)}`,
    `A${c} ${c} 0 0 0 ${n(x0)} ${t - c}`, // concave, into the tab
    `V${r}`,
    `A${r} ${r} 0 0 1 ${n(x0 + r)} 0`,
    `H${n(x1 - r)}`,
    `A${r} ${r} 0 0 1 ${n(x1)} ${r}`,
    `V${t - c}`,
    `A${c} ${c} 0 0 0 ${n(x1 + c)} ${t}`, // concave, out of the tab
    `H${w - R}`,
    `A${R} ${R} 0 0 1 ${w} ${t + R}`,
    `V${h - R}`,
    `A${R} ${R} 0 0 1 ${w - R} ${h}`,
    `H${R}`,
    `A${R} ${R} 0 0 1 0 ${h - R}`,
    `V${t + R}`,
    `A${R} ${R} 0 0 1 ${R} ${t}`,
    "Z",
  ].join(" ");
}
