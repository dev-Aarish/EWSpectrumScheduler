import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Scan EW Dashboard",
  description: "Electronic Warfare Spectrum Scheduler - Scan Strategy Visualization",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
