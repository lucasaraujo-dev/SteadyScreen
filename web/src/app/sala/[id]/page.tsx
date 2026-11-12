import { Suspense } from "react";
import { Brand } from "@/components/Logo";
import ViewerView from "@/components/ViewerView";

export const metadata = { title: "Assistindo · SteadyScreen" };

export default function Page() {
  return (
    <>
      <div className="page-brand">
        <Brand />
      </div>
      <Suspense fallback={<p className="loading">Carregando…</p>}>
        <ViewerView />
      </Suspense>
    </>
  );
}
