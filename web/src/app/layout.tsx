import type { Metadata } from "next";
import { Geist, Geist_Mono, Unbounded } from "next/font/google";
import InkBackground from "@/components/InkBackground";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font for big headlines.
const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SteadyScreen",
  description: "Compartilhe sua tela direto do navegador, sem instalar nada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable}`}>
      <body>
        <InkBackground />
        {/* One sheet of liquid glass over the whole screen. */}
        <div className="glass-screen" aria-hidden />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
