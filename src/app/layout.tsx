import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk, Space_Mono } from "next/font/google";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ThemeProvider } from "../components/ThemeProvider";
import { THEME_BOOT_SCRIPT } from "@/utils/theme";

/* Display, body and mono — the three families from DESIGN.md §3.1, self-hosted
   by next/font and swapped so nothing blocks the first paint. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

/* Absolute base for OG/Twitter image URLs. Vercel injects VERCEL_URL per
   deployment; NEXT_PUBLIC_SITE_URL wins when a custom domain is set. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "TinyImg — compress images in your browser",
  description:
    "Compress WebP, PNG and JPEG on your own device. No uploads, no account, no queue.",
  openGraph: {
    title: "TinyImg — compress images in your browser",
    description:
      "Compress WebP, PNG and JPEG on your own device. No uploads, no account, no queue.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexSans.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Before anything paints, and before React is anywhere near the page —
            see THEME_BOOT_SCRIPT. React never renders the attribute it sets,
            which is what `suppressHydrationWarning` above is for. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-body">
        <a href="#main" className="skip-link">
          Skip to content
        </a>

        {/* One instance, mounted at the root, never animated (§14.4). */}
        <div className="grain" aria-hidden="true" />

        <ThemeProvider>
          <Header />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
