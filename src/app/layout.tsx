import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RootProviders } from "@/components/providers/root-providers";
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
