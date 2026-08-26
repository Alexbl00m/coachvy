import Link from "next/link";

import { Logo } from "@/components/logo";
import { routes } from "@/lib/routes";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
      <section className="relative hidden flex-col justify-between border-r border-ink-800 bg-ink-850 p-10 lg:flex">
        <Link href="/" className="w-fit rounded-md">
          <Logo />
        </Link>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-ink-50">
            Träningsplanering med
            <span className="text-accent"> data i botten</span>.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-300">
            Coachvy samlar dina adepter, deras testresultat och deras planer på
            ett ställe – så att besluten du tar vilar på hur de faktiskt svarar
            på träningen.
          </p>
        </div>

        <p className="text-[12px] text-ink-500">
          © {new Date().getFullYear()} Coachvy
        </p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 inline-block rounded-md lg:hidden">
            <Logo />
          </Link>

          {children}

          <p className="mt-8 text-center text-[12px] text-ink-500">
            <Link
              href={routes.privacy}
              className="underline underline-offset-2 hover:text-ink-300"
            >
              Integritetspolicy & villkor
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
