import "./globals.css";
import React from "react";
import { Outfit } from "next/font/google";
import Head from "next/head";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata = {
  title: "TinyImg",
  description: "Compress your images with TinyImg",
  image: "/logo.svg",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:image" content={metadata.image} />
      </Head>
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
