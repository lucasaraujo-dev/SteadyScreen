import Link from "next/link";

/** The SteadyScreen mark. Drawn as a CSS mask, so it takes the text color. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return <span className="logo-mark" style={{ width: size, height: size }} aria-hidden />;
}

/** Mark + name, linking home. */
export function Brand({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="brand" aria-label="SteadyScreen, página inicial">
      <LogoMark size={size} />
      <span>SteadyScreen</span>
    </Link>
  );
}
