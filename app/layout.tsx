import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { WorkstationProvider } from '@/lib/context/workstation-context';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import ErrorBoundary from '@/components/ui/error-boundary';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TOSS Auto Trading Workstation v2",
  description: "AI-powered high-density live trading workstation for active traders, featuring custom MA crossover, RSI mean reversion bot simulation, and real-time ledger tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          <I18nProvider>
            <WorkstationProvider>
              {children}
            </WorkstationProvider>
          </I18nProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

