import { Suspense } from "react";
import { Brand } from "@/components/Logo";
import HostView from "@/components/HostView";

export const metadata = { title: "Compartilhando · SteadyScreen" };

export default function Page() {
  return (
    <>
      <div className="page-brand">
        <Brand />
      </div>
      <Suspense fallback={<p className="loading">Carregando…</p>}>
        <HostView />
      </Suspense>
    </>
  );
}
