import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

/**
 * The public site runs on the light surface. `theme-light` re-points the
 * semantic colour tokens for everything inside it; the app keeps the dark
 * defaults from :root.
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
    <div className="theme-light flex min-h-screen flex-col bg-canvas text-text">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
