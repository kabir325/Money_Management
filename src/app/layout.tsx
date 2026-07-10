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
  title: "Personal Finance",
  description:
    "A mobile-first password protected personal finance dashboard for tracking balances, expenses, savings, salary cycles, and loan progress.",
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
      <body className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(47,111,237,0.1),_transparent_18%),linear-gradient(180deg,#08111f_0%,#0b1422_45%,#101a2a_100%)] text-slate-50">
        {children}
      </body>
    </html>
  );
}
