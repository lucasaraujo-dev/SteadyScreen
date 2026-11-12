import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SteadyScreen",
  description: "Compartilhe sua tela direto do navegador, sem instalar nada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            <span className="brand-dot" aria-hidden />
            SteadyScreen
          </Link>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
