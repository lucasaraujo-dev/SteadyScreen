"use client";

import { useId, type ButtonHTMLAttributes, type CSSProperties } from "react";

// A black ink button that drips. The pill and the drops sit in one layer run
// through a "goo" SVG filter (blur + alpha threshold), so drops stay attached
// to the pill by a stretching neck and pinch off like real liquid. The label
// lives outside that layer so the text stays crisp.

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean };

// Ink runs hanging under the pill: [left %, width px, length px, breathe s].
const RUNS: [number, number, number, number][] = [
  [17, 14, 24, 4.2],
  [47, 18, 34, 5.1],
  [80, 12, 18, 3.6],
];

// Falling drops: [left %, size px, fall s, delay s, start below the edge px].
// Most fall from the tip of a run; a couple drip straight off the pill.
const DRIPS: [number, number, number, number, number][] = [
  [17, 14, 3.6, 0, 20],
  [47, 18, 3.1, 0.9, 30],
  [80, 12, 4.2, 1.8, 14],
  [32, 12, 4.4, 2.4, 0],
  [64, 13, 3.9, 1.5, 0],
];

// Extra drops that only fall while hovering (or while busy).
const HOVER_DRIPS: [number, number, number, number, number][] = [
  [17, 12, 1.7, 0.3, 20],
  [47, 15, 1.5, 0.8, 30],
  [80, 11, 1.9, 0.1, 14],
  [57, 12, 2.1, 0.5, 0],
];

type Drip = [number, number, number, number, number];

function drip([left, size, dur, delay, start]: Drip, key: string, extra = "") {
  return (
    <span
      key={key}
      className={`ink-drip${extra}`}
      style={
        {
          left: `${left}%`,
          width: size,
          height: size,
          animationDuration: `${dur}s`,
          animationDelay: `${delay}s`,
          "--start": `${start}px`,
        } as CSSProperties
      }
    />
  );
}

export default function InkButton({ busy, className, children, ...rest }: Props) {
  const filterId = `ink-goo-${useId().replace(/:/g, "")}`;

  return (
    <button {...rest} className={`ink-btn${busy ? " is-busy" : ""}${className ? ` ${className}` : ""}`}>
      <svg className="ink-btn-defs" aria-hidden focusable="false">
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
        </filter>
      </svg>

      <span
        className="ink-btn-goo"
        style={{ filter: `url(#${filterId}) drop-shadow(0 10px 16px rgba(0, 0, 0, 0.22))` }}
        aria-hidden
      >
        <span className="ink-btn-body" />
        {RUNS.map(([left, width, length, dur], i) => (
          <span
            key={`r${i}`}
            className="ink-run"
            style={{ left: `${left}%`, width, height: length, animationDuration: `${dur}s`, animationDelay: `${-i * 1.3}s` }}
          />
        ))}
        {DRIPS.map((d, i) => drip(d, `d${i}`))}
        {HOVER_DRIPS.map((d, i) => drip(d, `h${i}`, " ink-drip-hover"))}
      </span>

      <span className="ink-btn-label">{children}</span>
    </button>
  );
}
