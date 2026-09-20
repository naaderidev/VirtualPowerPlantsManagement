import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import Providers from "@/components/providers";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VPP - سامانه مدیریت انرژی",
    template: "%s | VPP",
  },
  description: "سامانه مدیریت خرید برق از نیروگاه‌های کوچک و بزرگ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
