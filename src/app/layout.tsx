import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { HistoryRail } from "@/components/layout/HistoryRail";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research Wiki",
  description: "Investment research knowledge base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <Navbar />
        <HistoryRail />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
