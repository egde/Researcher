import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { SessionProvider } from "@/components/providers/SessionProvider";
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
        <SessionProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
