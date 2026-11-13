"use client";

import { useEffect, useRef, useState } from "react";

type Corner = "tl" | "tr" | "bl" | "br";

/**
 * The camera in a corner of the stage, on top of the shared screen. Drag it
 * and it snaps to the nearest corner.
 */
export default function CameraCorner({
  stream,
  mirrored,
}: {
  stream: MediaStream;
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [corner, setCorner] = useState<Corner>("tr");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  function down(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
  }

  function move(e: React.PointerEvent) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  }

  function up(e: React.PointerEvent) {
    if (!start.current) return;
    start.current = null;
    setDrag(null);
    const parent = boxRef.current?.parentElement?.getBoundingClientRect();
    if (!parent) return;
    // Snap to the corner nearest to where it was let go.
    const top = e.clientY < parent.top + parent.height / 2;
    const left = e.clientX < parent.left + parent.width / 2;
    setCorner(`${top ? "t" : "b"}${left ? "l" : "r"}`);
  }

  return (
    <div
      ref={boxRef}
      className={`camera-corner is-${corner}${drag ? " is-dragging" : ""}`}
      style={
        drag ? { transform: `translate(${drag.x}px, ${drag.y}px)` } : undefined
      }
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={mirrored ? "is-mirrored" : undefined}
      />
    </div>
  );
}
