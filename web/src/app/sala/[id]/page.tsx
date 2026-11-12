import { Suspense } from "react";
import ViewerView from "@/components/ViewerView";
import Screen from "@/components/Screen";

export const metadata = { title: "Assistindo · SteadyScreen" };

export default function Page() {
  return (
    <Screen variant="dark">
      <Suspense fallback={<p className="loading">Carregando…</p>}>
        <ViewerView />
      </Suspense>
    </Screen>
  );
}
