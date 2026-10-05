import { SignUp } from "@/components/auth/sign-up-form";

export const metadata = { title: "Skapa konto" };

export default async function RegistreraPage({
  searchParams,
}: PageProps<"/registrera">) {
  // Coachens inbjudningslänk: /registrera?inbjudan=adept&namn=…&epost=…
  const query = await searchParams;
  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  const invite =
    query.inbjudan === "adept"
      ? { name: text(query.namn, 120), email: text(query.epost, 200) }
      : null;

  return <SignUp invite={invite} />;
}
