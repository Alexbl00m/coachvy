import type { CommunityChannel } from "@/lib/types/database";

export const CHANNELS: { key: CommunityChannel; label: string }[] = [
  { key: "allmant", label: "Allmänt" },
  { key: "lopning", label: "Löpning" },
  { key: "cykling", label: "Cykel" },
  { key: "simning", label: "Simning" },
  { key: "triathlon", label: "Triathlon" },
];

export const channelLabel = (key: string) =>
  CHANNELS.find((c) => c.key === key)?.label ?? "Allmänt";

export function parseChannel(raw: string | null | undefined): CommunityChannel | null {
  return CHANNELS.some((c) => c.key === raw) ? (raw as CommunityChannel) : null;
}

/** Passets gren till kanalen det hör hemma i. */
export function channelForSport(sport: string | null | undefined): CommunityChannel {
  if (sport === "löpning") return "lopning";
  if (sport === "cykling") return "cykling";
  if (sport === "simning") return "simning";
  return "allmant";
}
