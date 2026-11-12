"use client";

import { useEffect, useRef } from "react";
import {
  FrameWatchdog,
  isSoftwareRenderer,
  rememberStatic,
  staticReasonBeforeStart,
  type StaticReason,
} from "@/lib/backgroundMode";

// Full-screen Three.js background: flat black gooey "ink" blobs on a light
// gray backdrop, stretching out of a central blob and melting back into it.
// Rendered with a raymarching shader at low resolution (it sits behind blurred glass, so detail is wasted). Weak or
// struggling devices fall back to a static CSS version (see backgroundMode.ts).

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uPointer;

  const int BLOBS = 6;
  const float BOUND = 4.2;
  const vec3 BACKGROUND = vec3(0.80);  // flat light gray
  const vec3 INK = vec3(0.0);          // flat black, no shading

  // Polynomial smooth minimum: the "goo" between blobs.
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Each satellite blob travels out from the core and back, shrinking as it leaves.
  vec4 blob(int i, float t) {
    float fi = float(i);
    vec3 dir = normalize(vec3(
      sin(fi * 2.40 + t * 0.13),
      cos(fi * 1.70 + t * 0.11) * 0.75,
      sin(fi * 3.10 + t * 0.07) * 0.45
    ));
    float ext = 0.5 + 0.5 * sin(t * (0.32 + fi * 0.06) + fi * 1.9);
    ext = ext * ext * (3.0 - 2.0 * ext); // linger at both ends
    vec3 pos = dir * mix(0.15, 2.6, ext);
    float radius = mix(0.62, 0.34, ext);
    return vec4(pos, radius);
  }

  float wobble(vec3 p, float t) {
    return 0.045 * sin(p.x * 3.7 + t * 0.9) * sin(p.y * 4.1 + t * 1.1) * sin(p.z * 3.3 + t * 0.7);
  }

  float map(vec3 p, float t) {
    float d = length(p) - 0.95; // core
    for (int i = 0; i < BLOBS; i++) {
      vec4 b = blob(i, t);
      d = smin(d, length(p - b.xyz) - b.w, 0.75);
    }
    return d + wobble(p, t);
  }

  void main() {
    float t = uTime;
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

    // Camera drifts gently toward the pointer.
    vec3 ro = vec3(uPointer * 0.6, 6.2);
    vec3 fw = normalize(-ro);
    vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(rt, fw);
    vec3 rd = normalize(fw * 1.5 + rt * uv.x + up * uv.y);

    float coverage = 0.0;

    // Keep the cluster off to the right on wide screens so text stays readable.
    float aspect = uRes.x / uRes.y;
    vec3 center = vec3(1.7 * clamp((aspect - 1.0) / 0.8, 0.0, 1.0), 0.25, 0.0);
    ro -= center;

    // Skip rays that miss the bounding sphere entirely.
    float b = dot(ro, rd);
    float c = dot(ro, ro) - BOUND * BOUND;
    float disc = b * b - c;
    if (disc > 0.0) {
      float tt = max(-b - sqrt(disc), 0.0);
      float tFar = -b + sqrt(disc);
      float minD = 1e3;
      for (int i = 0; i < 64; i++) {
        float d = map(ro + rd * tt, t);
        minD = min(minD, d);
        if (d < 0.002) break;
        tt += d * 0.9;
        if (tt > tFar) break;
      }
      // Anti-aliased silhouette: about one pixel wide at the rendered resolution.
      float px = 6.2 * 1.5 / uRes.y * 2.0;
      coverage = 1.0 - smoothstep(0.0, px, minD);
    }

    gl_FragColor = vec4(mix(BACKGROUND, INK, coverage), 1.0);
  }
`;

// The scene sits behind a 42px glass blur, so a quarter-ish resolution looks
// identical and lets it run at the display's full refresh rate.
const RENDER_SCALE = 0.35; // fraction of CSS pixels actually rendered
const REDUCED_SCALE = 0.2; // first fallback when frames are slow

export default function InkBackground() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    const goStatic = (reason: StaticReason) => {
      cleanup();
      cleanup = () => {};
      rememberStatic(reason);
      console.info(`[SteadyScreen] fundo animado desligado (${reason}); usando o fundo estático.`);
    };

    const early = staticReasonBeforeStart();
    if (early) {
      goStatic(early);
      return;
    }

    // three.js is only downloaded when the device passed the checks above.
    void import("three").then((THREE) => {
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
      } catch {
        goStatic("no-webgl");
        return;
      }
      if (isSoftwareRenderer(renderer.getContext())) {
        renderer.dispose();
        goStatic("software-gpu");
        return;
      }
      renderer.setPixelRatio(RENDER_SCALE);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2() },
        uPointer: { value: new THREE.Vector2() },
      };
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
      const geometry = new THREE.PlaneGeometry(2, 2);
      scene.add(new THREE.Mesh(geometry, material));

      const resize = () => {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        renderer.getDrawingBufferSize(uniforms.uRes.value);
      };
      resize();
      window.addEventListener("resize", resize);

      const pointerTarget = new THREE.Vector2();
      const onPointer = (e: PointerEvent) => {
        pointerTarget.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      };
      window.addEventListener("pointermove", onPointer);

      let raf = 0;
      let last = performance.now();
      let time = 7; // start mid-animation so blobs are already spread out

      const watchdog = new FrameWatchdog(last);

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = now - last;
        last = now;

        const verdict = watchdog.frame(now, dt);
        if (verdict === "reduce") {
          renderer.setPixelRatio(REDUCED_SCALE);
          resize();
        } else if (verdict === "static") {
          goStatic("slow");
          return;
        }

        time += Math.min(dt, 100) / 1000;
        uniforms.uTime.value = time;
        // Same easing speed at 60, 120 or 144 Hz.
        uniforms.uPointer.value.lerp(pointerTarget, 1 - Math.pow(0.96, Math.min(dt, 100) / 16.7));
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      // Don't burn GPU in a background tab, and don't count the pause as a slow frame.
      const onVisibility = () => {
        cancelAnimationFrame(raf);
        if (!document.hidden) {
          last = performance.now();
          watchdog.reset(last);
          raf = requestAnimationFrame(frame);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <>
      {/* Static look-alike, always underneath: what weak devices see. */}
      <div className="ink-static" aria-hidden />
      <div ref={hostRef} className="ink-bg" aria-hidden />
    </>
  );
}
