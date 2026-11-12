import { Suspense } from "react";
import HostView from "@/components/HostView";
import Screen from "@/components/Screen";

export const metadata = { title: "Compartilhando · SteadyScreen" };

export default function Page() {
  return (
    <Screen variant="dark">
      <Suspense fallback={<p className="loading">Carregando…</p>}>
        <HostView />
      </Suspense>
    </Screen>
  );
}
