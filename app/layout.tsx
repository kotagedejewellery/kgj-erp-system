import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import Providers from "./providers";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

const playfairDisplay = localFont({
  src: "./fonts/playfair-display-latin.woff2",
  variable: "--font-playfair",
  weight: "400 700",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "400 600",
  display: "swap",
});

const dmSans = localFont({
  src: "./fonts/dm-sans-latin.woff2",
  variable: "--font-dm-sans",
  weight: "300 700",
  display: "swap",
});

const dmSerifDisplay = localFont({
  src: "./fonts/dm-serif-display-latin.woff2",
  variable: "--font-dm-serif",
  weight: "400",
  display: "swap",
});

// shortcut: local bundle contains the Latin subset, add language subsets if customer data needs them.
const cormorantGaramond = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-latin.woff2", weight: "300 700", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-italic.woff2", weight: "300 700", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KGJ ERP",
  description: "An ERP system for KGJ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} ${inter.variable} ${dmSans.variable} ${dmSerifDisplay.variable} ${cormorantGaramond.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
