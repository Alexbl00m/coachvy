import { CoachInvitations } from "@/components/adepts/coach-invitations";
import { CommunityFeed } from "@/components/community/community-feed";
import { PageHeader } from "@/components/page-header";
import { listCoachInvitations } from "@/lib/adepts/invitations";
import { requireSessionUser } from "@/lib/auth/session";
import { canUseCommunity } from "@/lib/community/access";
import { MembersOnly } from "@/components/members-only";
import { parseChannel } from "@/lib/community/channels";
import { PAGE_SIZE, getFeed, getShareables } from "@/lib/community/queries";

export const metadata = { title: "Community" };

export default async function CommunityPage({ searchParams }: PageProps<"/app/community">) {
  const user = await requireSessionUser();
  const query = await searchParams;
  const channel = parseChannel(typeof query.kanal === "string" ? query.kanal : null);

  if (!canUseCommunity(user)) {
    const invitations = user.profile?.role === "adept" ? await listCoachInvitations() : [];
    return (
      <>
        <PageHeader title="Community" description="Coacher och adepter som tränar tillsammans." />
        <CoachInvitations invitations={invitations} />
        <MembersOnly
          feature="Communityn"
          description="Flödet, kanalerna per gren och att dela pass och tester med andra är en del av medlemskapet i Coachvy."
        />
      </>
    );
  }

  const [posts, shareables] = await Promise.all([getFeed(channel), getShareables(user)]);

  return (
    <>
      <PageHeader
        title="Community"
        description="Coacher och adepter som tränar tillsammans. Dela pass, testresultat och frågor."
      />
      <CommunityFeed
        key={channel ?? "alla"}
        channel={channel}
        initialPosts={posts}
        hasMore={posts.length === PAGE_SIZE}
        shareables={shareables}
        me={{ id: user.id, isAdmin: user.isAdmin }}
      />
    </>
  );
}

