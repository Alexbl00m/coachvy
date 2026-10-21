import { TestResultsPanel } from "@/components/tests/test-results-panel";
import { loadWorkspace } from "@/lib/adepts/workspace";
import { listTestResults, listTestTypes } from "@/lib/tests/queries";

export const metadata = { title: "Enstaka värden" };

export default async function AdeptValuesPage({
  params,
}: PageProps<"/app/adepter/[id]/tester/varden">) {
  const { adept, canEdit } = await loadWorkspace(params);
  const [results, testTypes] = await Promise.all([
    listTestResults(adept.id),
    canEdit ? listTestTypes() : Promise.resolve([]),
  ]);
  return (
    <TestResultsPanel
      adeptId={adept.id}
      adeptName={adept.full_name}
      results={results}
      testTypes={testTypes}
      canEdit={canEdit}
    />
  );
}
