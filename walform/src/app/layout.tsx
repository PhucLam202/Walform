import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { FloatingChatWidget } from "@/components/shared/FloatingChatWidget";

export const metadata: Metadata = {
  title: "WalForm — Build forms. Store forever. Own your data.",
  description: "Decentralized form platform built on Walrus + Sui + Seal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <FloatingChatWidget />
          <Toaster richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
