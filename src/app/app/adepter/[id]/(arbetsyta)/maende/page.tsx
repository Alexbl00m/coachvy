import { LoadPanel } from "@/components/training/load-panel";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { listCheckins } from "@/lib/training/queries";

export const metadata = { title: "Mående" };

export default async function AdeptMaendePage({
  params,
  searchParams,
}: PageProps<"/app/adepter/[id]/maende">) {
  const { adept } = await loadWorkspace(params);
  const query = await searchParams;
  const checkins = await listCheckins(adept.id);
  return (
    <LoadPanel
      adeptId={adept.id}
      checkins={checkins}
      logSession={query.pass === "1"}
    />
  );
}
