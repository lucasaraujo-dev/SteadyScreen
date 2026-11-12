import type { Sharing } from "@/lib/room";

/** Screen (or camera) outline with a blue light running along its lines. */
export default function LiveIcon({
  kind,
  size = 16,
}: {
  kind: Sharing;
  size?: number;
}) {
  // pathLength=100 lets one dash pattern travel every shape at the same pace.
  const shapes =
    kind === "camera" ? (
      <>
        <rect x="2.5" y="6" width="13" height="12" rx="2.5" pathLength={100} />
        <path d="m15.5 10.5 6-3.5v10l-6-3.5" pathLength={100} />
      </>
    ) : (
      <>
        <rect
          x="2.5"
          y="3.5"
          width="19"
          height="13"
          rx="2.5"
          pathLength={100}
        />
        <path d="M8 20.5h8M12 16.5v4" pathLength={100} />
      </>
    );

  return (
    <svg
      className="live-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <g className="live-icon-base">{shapes}</g>
      <g className="live-icon-light">{shapes}</g>
    </svg>
  );
}
