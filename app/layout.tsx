// Root layout — fonts, metadata, and the centered 720px column shell
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Caleb Abuabara",
  description: "Talk to an AI trained to be me.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-ink font-sans overflow-hidden">
        {/* Centered column — border lines on desktop, full-width on mobile */}
        <div className="mx-auto w-full max-w-[720px] min-h-screen sm:border-x sm:border-line">
          {children}
        </div>
      </body>
    </html>
  );
}
