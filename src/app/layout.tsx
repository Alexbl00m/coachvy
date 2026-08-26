import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

import { site } from "@/lib/site";

const montserrat = Montserrat({
  variable: "--font-montserrat",
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
    <html lang="sv" className={`${montserrat.variable} h-full`}>
      <body className="min-h-full bg-canvas text-text">{children}</body>
    </html>
  );
}
