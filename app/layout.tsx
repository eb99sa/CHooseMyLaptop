import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/i18n";
import BackgroundLaptop from "@/components/landing/BackgroundLaptop";
import "./globals.css";

// Arabic-first + Latin sans — the readable workhorse (Arabic stays a real sans,
// never thin/serif). Weights 400–700.
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

// Mono for Latin micro-labels, spec codes, and scores (LTR contexts).
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Thin Latin display — the EMO "whisper" (GT-Flexa substitute). Rides only on
// Latin display + numerals; weight 200 is the signature.
const inter = Inter({
  subsets: ["latin"],
  weight: ["200", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial serif — Latin body accent (Times substitute), used sparingly.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — اختر اللابتوب المناسب لك`,
  description: APP_TAGLINE,
};

// Dark-only "Electronic Materials Office" theme — the browser chrome matches the
// charcoal canvas.
export const viewport: Viewport = {
  themeColor: "#202020",
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
      className={`${plexArabic.variable} ${plexMono.variable} ${inter.variable} ${sourceSerif.variable}`}
    >
      <body>
        {children}
        <BackgroundLaptop />
      </body>
    </html>
  );
}
