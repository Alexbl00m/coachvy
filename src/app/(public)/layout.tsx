import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

/**
 * Sajten och appen delar den mörka paletten och Geist (DESIGN.md), så att
 * steget från startsidan in i Coachvy inte byter värld.
 */
/**
 * The header reads the session to decide between "Logga in" and "Min översikt",
 * so these pages are rendered per request. Without this the outcome would
 * depend on whether Supabase credentials happened to be set at build time —
 * a build without them prerenders the signed-out header and freezes it.
 */
export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
