import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Unbounded } from "next/font/google";
import "./globals.css";
import "./room.css";

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

// iOS-like UI font: Apple devices use their own SF Pro, everyone else gets Inter
// (the closest free match; SF Pro itself can't be shipped on a website).
const inter = Inter({
  variable: "--font-ios",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SteadyScreen",
  description: "Compartilhe sua tela direto do navegador, sem instalar nada.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${unbounded.variable} ${inter.variable}`}
    >
      {/* Each page brings its own full-screen background (see Screen.tsx). */}
      <body>{children}</body>
    </html>
  );
}
