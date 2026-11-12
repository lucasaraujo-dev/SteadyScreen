import { Suspense } from "react";
import ViewerView from "@/components/ViewerView";

export const metadata = { title: "Assistindo · SteadyScreen" };

export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Carregando…</p>}>
      <ViewerView />
    </Suspense>
  );
}
