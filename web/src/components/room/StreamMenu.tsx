"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  GearIcon,
} from "@/components/icons";
import type { Fps, Output, Resolution } from "@/lib/host";

type Props = {
  output: Output;
  onChange: (output: Output) => void;
  /** Height of what is being captured, to label "Original" and skip bigger options. */
  sourceHeight?: number;
};

type Page = "main" | "resolution" | "fps";

const RESOLUTIONS: Resolution[] = ["source", 1080, 720, 480];
const FPS: Fps[] = [60, 30, 15];

/** Gear on the stage: a small menu to pick the stream's resolution and frame rate. */
export default function StreamMenu({ output, onChange, sourceHeight }: Props) {
  const [page, setPage] = useState<Page | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!page) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPage(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPage(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [page]);

  const resolutions = RESOLUTIONS.filter(
    (r) => r === "source" || !sourceHeight || r < sourceHeight,
  );
  const resolutionLabel = (r: Resolution) =>
    r === "source"
      ? sourceHeight
        ? `Original (${sourceHeight}p)`
        : "Original"
      : `${r}p`;

  function pick(next: Partial<Output>) {
    onChange({ ...output, ...next });
    setPage("main");
  }

  return (
    <div ref={ref} className={`stream-menu${page ? " is-open" : ""}`}>
      <button
        type="button"
        className={`tool-btn${page ? " is-active" : ""}`}
        onClick={() => setPage(page ? null : "main")}
        aria-label="Qualidade e FPS"
        aria-expanded={!!page}
        aria-haspopup="menu"
      >
        <GearIcon size={18} />
        <span className="tool-tip" aria-hidden>
          Qualidade e FPS
        </span>
      </button>

      {page && (
        <div className="menu-panel" role="menu" key={page}>
          {page === "main" && (
            <>
              <button
                type="button"
                className="menu-row"
                role="menuitem"
                onClick={() => setPage("resolution")}
              >
                <span>Qualidade</span>
                <span className="menu-value">
                  {output.resolution === "source"
                    ? "Original"
                    : `${output.resolution}p`}
                  <ChevronRightIcon size={16} />
                </span>
              </button>
              <button
                type="button"
                className="menu-row"
                role="menuitem"
                onClick={() => setPage("fps")}
              >
                <span>FPS</span>
                <span className="menu-value">
                  {output.fps}
                  <ChevronRightIcon size={16} />
                </span>
              </button>
            </>
          )}

          {page !== "main" && (
            <>
              <button
                type="button"
                className="menu-back"
                onClick={() => setPage("main")}
              >
                <ChevronLeftIcon size={16} />
                {page === "resolution" ? "Qualidade" : "FPS"}
              </button>
              {page === "resolution" &&
                resolutions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="menu-row"
                    role="menuitemradio"
                    aria-checked={output.resolution === r}
                    onClick={() => pick({ resolution: r })}
                  >
                    <span>{resolutionLabel(r)}</span>
                    {output.resolution === r && <CheckIcon size={16} />}
                  </button>
                ))}
              {page === "fps" &&
                FPS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="menu-row"
                    role="menuitemradio"
                    aria-checked={output.fps === f}
                    onClick={() => pick({ fps: f })}
                  >
                    <span>{f} FPS</span>
                    {output.fps === f && <CheckIcon size={16} />}
                  </button>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
