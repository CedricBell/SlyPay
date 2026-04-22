import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "SlyPay — Real-time card recommendations",
  description:
    "Transaction-level credit card recommendations from official-style rules, offers, and merchant context.",
  manifest: "/manifest.webmanifest",
  themeColor: "#10b981",
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
        <main className="mx-auto max-w-5xl px-4 py-8 pb-28 md:pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
