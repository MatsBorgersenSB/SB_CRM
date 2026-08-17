import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { RootProviders } from "@/components/providers/root-providers";
import { outlookHistoryPolyfillScript } from "@/lib/outlook-addin-shell";
import { themeBootScript } from "@/lib/theme-preference";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UPCYCLE",
  description: "Pipeline operations console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans text-foreground">
        {/*
          beforeInteractive only works from the root layout.
          Outlook Web stubs history.pushState/replaceState; Next App Router
          calls them on hydrate and crashes. Polyfill is a no-op when History works.
        */}
        <Script
          id="smartcrm-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootScript() }}
        />
        <Script
          id="smartcrm-outlook-history-polyfill"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: outlookHistoryPolyfillScript() }}
        />
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
