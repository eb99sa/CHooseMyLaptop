import type { Metadata, Viewport } from "next";
import { Tajawal, JetBrains_Mono } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/i18n";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

// Techno-accent monospace for numerals, prices, and scores (LTR contexts).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono-techno",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — اختر اللابتوب المناسب لك`,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  themeColor: "#0a0e0d",
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
      className={`${tajawal.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
