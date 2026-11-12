import Home from "@/components/Home";
import InkBackground from "@/components/InkBackground";
import Screen from "@/components/Screen";

export default function Page() {
  return (
    <Screen variant="ink">
      <InkBackground />
      {/* One sheet of liquid glass over the whole screen. */}
      <div className="glass-screen" aria-hidden />
      <main className="main">
        <Home />
      </main>
    </Screen>
  );
}
