"use server";

import { revalidatePath } from "next/cache";

import { requireSessionUser } from "@/lib/auth/session";
import { routes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { CommunityComment, CommunityFeedItem } from "@/lib/types/database";
import { canUseCommunity } from "./access";
import { testAttachment, workoutAttachment } from "./attachments";
import { parseChannel } from "./channels";
import { getFeed } from "./queries";

type Result = { ok: true } | { ok: false; error: string };

async function member() {
  const user = await requireSessionUser();
  if (!canUseCommunity(user)) {
    throw new Error("Communityn är för coacher och adepter som är kopplade till en coach.");
  }
  return user;
}

export async function createPost(input: {
  channel: string;
  body: string;
  share: { kind: "workout" | "test"; id: string } | null;
}): Promise<Result> {
  const user = await member();
  const body = input.body.trim();
  const channel = parseChannel(input.channel) ?? "allmant";
  if (!body) return { ok: false, error: "Skriv något först." };
  if (body.length > 5000) return { ok: false, error: "Inlägget är för långt (högst 5 000 tecken)." };

  let attachment = null;
  if (input.share) {
    attachment =
      input.share.kind === "workout"
        ? await workoutAttachment(input.share.id)
        : await testAttachment(input.share.id, user.id);
    if (!attachment) return { ok: false, error: "Det du försökte dela gick inte att hitta." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("community_posts")
    .insert({ author_id: user.id, channel, body, attachment });
  if (error) return { ok: false, error: `Kunde inte publicera: ${error.message}` };

  revalidatePath(routes.community);
  return { ok: true };
}

export async function deletePost(id: string): Promise<Result> {
  await member();
  const supabase = await createClient();
  // Databasen släpper bara igenom författaren och admin.
  const { error, count } = await supabase
    .from("community_posts")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Du kan bara ta bort dina egna inlägg." };
  revalidatePath(routes.community);
  return { ok: true };
}

export async function toggleLike(postId: string, like: boolean): Promise<Result> {
  const user = await member();
  const supabase = await createClient();
  const { error } = like
    ? await supabase.from("community_likes").upsert(
        { post_id: postId, profile_id: user.id },
        { onConflict: "post_id,profile_id", ignoreDuplicates: true },
      )
    : await supabase
        .from("community_likes")
        .delete()
        .eq("post_id", postId)
        .eq("profile_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function loadComments(postId: string): Promise<CommunityComment[]> {
  await member();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_post_comments", { p_post: postId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addComment(postId: string, body: string): Promise<Result> {
  const user = await member();
  const text = body.trim();
  if (!text) return { ok: false, error: "Skriv något först." };
  if (text.length > 2000) return { ok: false, error: "Kommentaren är för lång (högst 2 000 tecken)." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("community_comments")
    .insert({ post_id: postId, author_id: user.id, body: text });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteComment(id: string): Promise<Result> {
  await member();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("community_comments")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (!count) return { ok: false, error: "Du kan bara ta bort dina egna kommentarer." };
  return { ok: true };
}

/** Nästa sida av flödet. */
export async function loadMore(
  channel: string | null,
  before: string,
): Promise<CommunityFeedItem[]> {
  await member();
  return getFeed(parseChannel(channel), before);
}
