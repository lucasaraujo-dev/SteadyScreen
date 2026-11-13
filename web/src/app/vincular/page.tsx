import LinkPhone from "@/components/LinkPhone";
import Screen from "@/components/Screen";

export const metadata = { title: "Vincular celular · SteadyScreen" };

export default function Page() {
  return (
    <Screen variant="dark">
      <LinkPhone />
    </Screen>
  );
}
