import { Suspense } from "react";
import HostView from "@/components/HostView";

export const metadata = { title: "Compartilhando · SteadyScreen" };

export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Carregando…</p>}>
      <HostView />
    </Suspense>
  );
}
