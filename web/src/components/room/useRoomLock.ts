"use client";

import { useEffect } from "react";

/** Where right-click and Ctrl+A still work: chat bubbles and text fields. */
const FREE = ".msg-bubble, input, textarea, [contenteditable='true']";

function isFree(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(FREE);
}

/**
 * While a room is open: no right-click menu and no "select all", except in
 * the chat bubbles and the fields you type in. (CSS keeps the rest of the
 * page from being selected with the mouse.)
 */
export function useRoomLock() {
  useEffect(() => {
    const menu = (e: MouseEvent) => {
      if (!isFree(e.target)) e.preventDefault();
    };
    const keys = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "a" &&
        !isFree(e.target)
      )
        e.preventDefault();
    };
    document.addEventListener("contextmenu", menu);
    document.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("contextmenu", menu);
      document.removeEventListener("keydown", keys);
    };
  }, []);
}
