"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ChevronUpIcon } from "@/components/icons";

export type DropdownOption = { value: string; label: string };

type Props = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label: string;
};

/** A styled replacement for <select>: button + list, with keyboard support. */
export default function Dropdown({ value, options, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const current = options.find((o) => o.value === value) ?? options[0];

  // Close on a click outside the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open)
      listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function show() {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  }

  function choose(i: number) {
    onChange(options[i].value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape") {
      // Close just the list, not the whole menu around it.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={`dropdown${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="dropdown-btn"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${current?.label ?? ""}`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="dropdown-value">{current?.label}</span>
        <ChevronUpIcon size={14} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          className="dropdown-list"
          role="listbox"
          aria-label={label}
        >
          {options.map((o, i) => (
            <li
              key={o.value || "default"}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`dropdown-option${i === active ? " is-active" : ""}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {o.value === value && <CheckIcon size={15} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
