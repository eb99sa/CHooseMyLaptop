import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/i18n";
import BackgroundLaptop from "@/components/landing/BackgroundLaptop";
import "./globals.css";

// Arabic-first + Latin sans. Heavy bias (400/500/600/700); no thin weights.
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

// Mono for Latin micro-labels, numerals, prices, and scores (LTR contexts).
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — اختر اللابتوب المناسب لك`,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  themeColor: "#f1f2f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${plexMono.variable}`}
    >
      <body>
        {children}
        <BackgroundLaptop />
      </body>
    </html>
  );
}
