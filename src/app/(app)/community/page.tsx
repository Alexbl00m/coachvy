import { MessagesSquare } from "lucide-react";

import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata = { title: "Community" };

export default function CommunityPage() {
  return (
    <ModulePlaceholder
      title="Community"
      description="Utbyte mellan coacher och adepter."
      icon={MessagesSquare}
      planned={[
        "Delade trådar och inlägg",
        "Grupper per sport eller mål",
        "Delning av mallar mellan coacher",
      ]}
    />
  );
}
