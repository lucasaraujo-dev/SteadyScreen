import type { CSSProperties } from "react";

// Extruded ("blocky") 3D version of the logo, pure CSS: the mark is stacked
// in thin slices along the Z axis inside a preserve-3d box, so it is a real
// solid that can rotate. The front slice is the black face; the slices behind
// it form the sides, shaded from light (near the face) to dark (at the back).

type Props = { size?: number; depth?: number };

export default function Logo3D({ size = 96, depth = 18 }: Props) {
  const slices = Math.max(2, Math.round(depth)); // one slice per px of depth
  return (
    <span className="logo-3d" style={{ width: size, height: size } as CSSProperties} aria-hidden>
      <span className="logo-3d-solid">
        {Array.from({ length: slices }, (_, i) => {
          // i = 0 is the rearmost slice, i = slices - 1 the face.
          const t = i / (slices - 1); // 0 at the back, 1 at the front
          const isFace = i === slices - 1;
          // Side shading: dark at the back, lighter towards the face.
          const shade = Math.round(48 + t * 100);
          return (
            <span
              key={i}
              className={`logo-mark logo-3d-slice${isFace ? " is-face" : ""}`}
              style={{
                width: size,
                height: size,
                transform: `translateZ(${i - (slices - 1)}px)`,
                color: isFace ? undefined : `rgb(${shade}, ${shade + 1}, ${shade + 4})`,
              }}
            />
          );
        })}
      </span>
    </span>
  );
}
