"use client";

import { useEffect, useRef, useState } from "react";

/** Length of the closing animation (dialog.modal.is-closing in globals.css). */
const CLOSE_MS = 200;

/**
 * A native modal dialog that springs in and sinks out. Closing by the X
 * (the `close` handed to children), Esc or a click on the backdrop all play
 * the animation first, then call onClose.
 */
export default function Modal({
  open,
  onClose,
  className = "",
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The parent may hand a new onClose each render; the timer must not restart.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setClosing(false);
      onCloseRef.current();
    }, CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [closing]);

  const close = () => setClosing(true);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}${closing ? " is-closing" : ""}`}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault(); // Esc: animate out first
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()} // the backdrop
    >
      {open && (
        <div className="modal-body" onClick={(e) => e.stopPropagation()}>
          {children(close)}
        </div>
      )}
    </dialog>
  );
}
