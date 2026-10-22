import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

import { site } from "@/lib/site";

// Geist för text och siffror, Geist Mono för etiketter och siffror i kolumner,
// Instrument Serif för sidornas rubriker – påståendet sidan handlar om. Se
// DESIGN.md.
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

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
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

// `viewport-fit=cover` låter appens bottenrad räkna med hemindikatorn
// (`env(safe-area-inset-bottom)`) på telefoner utan hemknapp.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sv"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
    >
      <body className="min-h-full bg-canvas text-text">{children}</body>
    </html>
  );
}
