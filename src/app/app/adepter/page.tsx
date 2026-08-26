import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { listAdepts } from "@/lib/adepts/queries";
import { requireCoach } from "@/lib/auth/session";
import { formatLastActive } from "@/lib/format";
import { routes } from "@/lib/routes";

export const metadata = { title: "Adepter" };

export default async function AdepterPage() {
  // Adept accounts have no business on a coach's roster; they land here only
  // by typing the URL, and are sent back to their own overview.
  await requireCoach();
  const adepts = await listAdepts();

  return (
    <>
      <PageHeader
        title="Adepter"
        description="Dina adepter, deras profiler och koppling till dig som coach."
        action={
          <ButtonLink href={`${routes.adepts}/ny`} className="font-semibold">
            <Plus aria-hidden className="size-4" />
            Lägg till adept
          </ButtonLink>
        }
      />

      {adepts.length === 0 ? (
        <EmptyState
          title="Inga adepter ännu"
          description="Lägg upp din första adept så kan du börja registrera testresultat och följa utvecklingen."
          action={
            <ButtonLink href={`${routes.adepts}/ny`} className="font-semibold">
              <Plus aria-hidden className="size-4" />
              Lägg till adept
            </ButtonLink>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-ink-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-800 bg-ink-850 text-left">
                  <th className="px-4 py-3 font-medium text-ink-300">Namn</th>
                  <th className="px-4 py-3 font-medium text-ink-300">Sport</th>
                  <th className="px-4 py-3 font-medium text-ink-300">Nivå</th>
                  <th className="px-4 py-3 font-medium text-ink-300">
                    Senast aktiv
                  </th>
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Öppna</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {adepts.map((adept) => (
                  <tr
                    key={adept.id}
                    className="border-b border-ink-800 last:border-b-0 hover:bg-ink-850"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`${routes.adepts}/${adept.id}`}
                        className="font-medium text-ink-50 hover:text-accent"
                      >
                        {adept.full_name}
                      </Link>
                      {adept.email && (
                        <span className="block text-[12px] text-ink-400">
                          {adept.email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-300">
                      {adept.sport ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-ink-300">
                      {adept.current_level ?? "–"}
                    </td>
                    <td className="px-4 py-3 text-ink-400">
                      {formatLastActive(adept.last_active_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${routes.adepts}/${adept.id}`}
                        aria-label={`Öppna ${adept.full_name}`}
                        className="inline-flex text-ink-400 hover:text-accent"
                      >
                        <ChevronRight aria-hidden className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adepts.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-500">
          <Users aria-hidden className="size-3.5" />
          {adepts.length} {adepts.length === 1 ? "adept" : "adepter"}
        </p>
      )}
    </>
  );
}
