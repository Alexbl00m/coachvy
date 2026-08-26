import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getSessionUser();
  redirect(user ? routes.dashboard : routes.signIn);
}
