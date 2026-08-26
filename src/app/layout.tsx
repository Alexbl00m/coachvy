import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Coachvy",
    template: "%s · Coachvy",
  },
  description:
    "Coachvy – plattformen där coacher hanterar adepter, testresultat och träningsplaner.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className={`${montserrat.variable} h-full`}>
      <body className="min-h-full bg-ink-900 text-ink-100">{children}</body>
    </html>
  );
}
