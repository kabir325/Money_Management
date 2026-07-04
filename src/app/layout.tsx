import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Money Management Dashboard",
  description:
    "A mobile-first password protected dashboard for tracking expenses, savings, balance, and salary-cycle analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.16),_transparent_20%),linear-gradient(180deg,#020617_0%,#020617_45%,#0f172a_100%)] text-slate-50">
        {children}
      </body>
    </html>
  );
}
