import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { site } from "@/lib/site";

// Geist för sajten och appen, Geist Mono för siffror i kolumner. Se DESIGN.md.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${site.name} – ${site.tagline}`,
    template: `%s · ${site.name}`,
  },
  description:
    "Individuell coaching och skräddarsydda träningsplaner för uthållighetsidrott. Laktattest, VLamax och tröskeltestning i Norrköping.",
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: site.name,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sv"
      className={`${geist.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full bg-canvas text-text">{children}</body>
    </html>
  );
}
