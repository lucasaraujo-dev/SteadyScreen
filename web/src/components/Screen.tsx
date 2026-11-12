import { ViewTransition, type ReactNode } from "react";

// One full screen of the app (background + content). Every page renders its
// own Screen so the whole thing, background included, slides as one piece:
// "nav-forward" pushes the old screen out to the left and brings the new one
// in from the right; "nav-back" does the opposite. Navigations without a type
// (browser back button, refresh) don't animate.

const SLIDE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

type Props = { variant: "ink" | "dark"; children: ReactNode };

export default function Screen({ variant, children }: Props) {
  return (
    <ViewTransition enter={SLIDE} exit={SLIDE} default="none">
      <div className={`screen screen-${variant}`}>{children}</div>
    </ViewTransition>
  );
}
