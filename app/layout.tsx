import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { DeviceGate } from "@/components/ui/device-gate";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SokoSeal Point",
  description: "Point at a product, say what you want, and review a verified basket.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) to work on notched phones.
  viewportFit: "cover",
  themeColor: "#F7F7F4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <DeviceGate>{children}</DeviceGate>
      </body>
    </html>
  );
}