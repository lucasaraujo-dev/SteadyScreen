"use client";

import { useEffect, useState, type RefObject } from "react";

/** Width / height of what a <video> is playing (null until it has frames). */
export function useVideoAspect(ref: RefObject<HTMLVideoElement | null>, active: boolean) {
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !active) return;
    const read = () => {
      if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
    };
    // "resize" fires when the shared window or camera changes size.
    video.addEventListener("loadedmetadata", read);
    video.addEventListener("resize", read);
    read();
    return () => {
      video.removeEventListener("loadedmetadata", read);
      video.removeEventListener("resize", read);
    };
  }, [ref, active]);

  return active ? aspect : null;
}

/** Hands the aspect to CSS, which sizes the stage to fit it with no bars. */
export function stageStyle(aspect: number | null) {
  return aspect ? ({ "--ar": aspect } as React.CSSProperties) : undefined;
}
