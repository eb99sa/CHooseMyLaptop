import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { APP_NAME, APP_TAGLINE } from "@/lib/i18n";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — اختر اللابتوب المناسب لك`,
  description: APP_TAGLINE,
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body>{children}</body>
    </html>
  );
}
