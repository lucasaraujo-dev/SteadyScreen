import InkBackground from "@/components/InkBackground";
import PhonePanel from "@/components/PhonePanel";
import Screen from "@/components/Screen";

export const metadata = { title: "Celular · SteadyScreen" };

// Same look as the home page: the ink background under one sheet of glass.
export default function Page() {
  return (
    <Screen variant="ink">
      <InkBackground />
      <div className="glass-screen" aria-hidden />
      <PhonePanel />
    </Screen>
  );
}
