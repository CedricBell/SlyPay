import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { PwaRegister } from "@/components/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#6d28d9",
};

export const metadata: Metadata = {
  title: "SlyPay — Real-time card recommendations",
  description:
    "Transaction-level credit card recommendations from official-style rules, offers, and merchant context.",
  manifest: "/manifest.webmanifest",
  // Favicon: `src/app/icon.png` + `apple-icon.png` (App Router file convention).
  // Do not add `src/app/favicon.ico` — it overrides icon.png (often the Vercel template).
  appleWebApp: {
    capable: true,
    title: "SlyPay",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} page-sheen min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <PwaRegister />
        <NavBar />
        <main className="relative z-[1] isolate mx-auto max-w-5xl px-4 py-8 pb-28 md:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
