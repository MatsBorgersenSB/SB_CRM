import type { Metadata } from "next";
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
      <head>
        {/*
          Blocking inline scripts. The browser runs them while parsing, before React hydrates.
          next/script is a client component, and React 19 does not execute a script it creates.
          Outlook Web stubs history.pushState/replaceState; the polyfill is a no-op when History works.
        */}
        <script id="smartcrm-theme-boot" dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
        <script
          id="smartcrm-outlook-history-polyfill"
          dangerouslySetInnerHTML={{ __html: outlookHistoryPolyfillScript() }}
        />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
