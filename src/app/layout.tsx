import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalGuard } from "@/components/layout/GlobalGuard";
import { ToastProvider } from "@/context/ToastContext";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoldBook | Free Trading Journal for XAUUSD",
  description: "TradeFXBook - but free. Built for gold traders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased text-foreground bg-background">
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <ToastProvider>
          <GlobalGuard>
            {children}
          </GlobalGuard>
        </ToastProvider>
      </body>
    </html>
  );
}

