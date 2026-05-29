import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalGuard } from "@/components/layout/GlobalGuard";
import { ToastProvider } from "@/context/ToastContext";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoldBook | Professional Trading Journal & AI Behavioral Coach",
  description: "Track your trades, audit emotional discipline, and master your trading edge with Nirikshan AI. The ultimate journal built for professional retail, prop firm, Forex, and metal traders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="en" 
      className="dark h-full antialiased text-foreground bg-background"
      style={{ backgroundColor: '#060A12', colorScheme: 'dark' }}
    >
      <body 
        className={`${inter.className} min-h-full flex flex-col`}
        style={{ backgroundColor: '#060A12' }}
      >
        <ToastProvider>
          <GlobalGuard>
            {children}
          </GlobalGuard>
        </ToastProvider>
      </body>
    </html>
  );
}

