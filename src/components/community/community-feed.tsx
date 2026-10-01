"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Dumbbell, FlaskConical, Heart, MessageCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  loadComments,
  loadMore,
  toggleLike,
} from "@/lib/community/actions";
import { CHANNELS, channelLabel } from "@/lib/community/channels";
import type { Shareable } from "@/lib/community/queries";
import { routes } from "@/lib/routes";
import type {
  CommunityAttachment,
  CommunityChannel,
  CommunityComment,
  CommunityFeedItem,
} from "@/lib/types/database";

type Me = { id: string; isAdmin: boolean };

/** "nyss", "för 5 min sedan", "igår" – annars datumet. */
function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "nyss";
  if (minutes < 60) return `för ${minutes} min sedan`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `för ${hours} h sedan`;
  if (hours < 48) return "igår";
  return iso.slice(0, 10);
}

function Author({
  name,
  role,
  admin,
  at,
}: {
  name: string;
  role: string;
  admin: boolean;
  at: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
      <span className="font-medium text-text">{name}</span>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]",
          role === "coach" || admin ? "bg-accent-soft text-accent" : "bg-surface-2 text-text-muted",
        )}
      >
        {admin ? "Admin" : role === "coach" ? "Coach" : "Adept"}
      </span>
      <span className="text-text-subtle">{ago(at)}</span>
    </p>
  );
}

function Attachment({ item }: { item: CommunityAttachment }) {
  const Icon = item.kind === "workout" ? Dumbbell : FlaskConical;
  return (
    <div className="mt-3 rounded-md border border-line bg-surface-2/60 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-text">
        <Icon aria-hidden className="size-4 text-accent" />
        {item.title}
      </p>
      {item.subtitle && <p className="mt-0.5 text-[12px] text-text-subtle">{item.subtitle}</p>}
      {item.lines.length > 0 && (
        <dl className="mt-2 space-y-1 text-[13px]">
          {item.lines.map((line, i) => (
            <div key={i} className="flex gap-3">
              <dt className="w-20 shrink-0 text-text-subtle">{line.label}</dt>
              <dd className="min-w-0 text-text-muted tabular-nums">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Comments({ postId, me, onCount }: { postId: string; me: Me; onCount: (n: number) => void }) {
  const [items, setItems] = useState<CommunityComment[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = async () => {
    const next = await loadComments(postId);
    setItems(next);
    onCount(next.length);
  };

  // Hämtas när kommentarerna öppnas, inte innan – de flesta inlägg läses
  // utan att någon öppnar dem.
  useEffect(() => {
    let cancelled = false;
    loadComments(postId).then((next) => {
      if (cancelled) return;
      setItems(next);
      onCount(next.length);
    });
    return () => {
      cancelled = true;
    };
  }, [postId, onCount]);

  const send = () =>
    start(async () => {
      setError(null);
      const result = await addComment(postId, text);
      if (!result.ok) return setError(result.error);
      setText("");
      await refresh();
    });

  const remove = (id: string) =>
    start(async () => {
      const result = await deleteComment(id);
      if (!result.ok) return setError(result.error);
      await refresh();
    });

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {items === null ? (
        <p className="text-[13px] text-text-subtle">Hämtar …</p>
      ) : (
        items.map((c) => (
          <div key={c.id} className="group">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Author name={c.author_name} role={c.author_role} admin={c.author_is_admin} at={c.created_at} />
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-text-muted">{c.body}</p>
              </div>
              {(c.author_id === me.id || me.isAdmin) && (
                <button
                  type="button"
                  aria-label="Ta bort kommentaren"
                  onClick={() => remove(c.id)}
                  className="rounded p-1 text-text-subtle hover:text-text"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ))
      )}
      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Skriv en kommentar"
          rows={1}
          placeholder="Skriv en kommentar …"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-9"
        />
        <Button type="button" size="sm" onClick={send} disabled={pending || !text.trim()}>
          Skicka
        </Button>
      </div>
      {error && <p className="text-[13px] text-text">{error}</p>}
    </div>
  );
}

function Post({ post, me, onDeleted }: { post: CommunityFeedItem; me: Me; onDeleted: () => void }) {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(Number(post.likes));
  const [comments, setComments] = useState(Number(post.comments));
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  const like = () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    start(async () => {
      const result = await toggleLike(post.id, next);
      if (!result.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
      }
    });
  };

  const remove = () => {
    if (!window.confirm("Ta bort inlägget?")) return;
    start(async () => {
      const result = await deletePost(post.id);
      if (result.ok) onDeleted();
    });
  };

  return (
    <Card className="min-w-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Author name={post.author_name} role={post.author_role} admin={post.author_is_admin} at={post.created_at} />
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.1em] text-text-subtle">
            {channelLabel(post.channel)}
          </p>
        </div>
        {(post.author_id === me.id || me.isAdmin) && (
          <button
            type="button"
            aria-label="Ta bort inlägget"
            onClick={remove}
            className="rounded p-1 text-text-subtle hover:text-text"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text">{post.body}</p>
      {post.attachment && <Attachment item={post.attachment} />}

      <div className="mt-3 flex gap-4 text-[13px]">
        <button
          type="button"
          aria-pressed={liked}
          onClick={like}
          className={cn(
            "inline-flex items-center gap-1.5 transition-colors",
            liked ? "text-accent" : "text-text-muted hover:text-text",
          )}
        >
          <Heart aria-hidden className={cn("size-4", liked && "fill-current")} />
          {likes > 0 ? likes : "Gilla"}
        </button>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-text-muted transition-colors hover:text-text"
        >
          <MessageCircle aria-hidden className="size-4" />
          {comments > 0 ? `${comments} ${comments === 1 ? "kommentar" : "kommentarer"}` : "Kommentera"}
        </button>
      </div>

      {open && <Comments postId={post.id} me={me} onCount={setComments} />}
    </Card>
  );
}

function Composer({
  channel,
  shareables,
}: {
  channel: CommunityChannel | null;
  shareables: Shareable[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<CommunityChannel>(channel ?? "allmant");
  const [share, setShare] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const publish = () =>
    start(async () => {
      setError(null);
      const picked = shareables.find((s) => `${s.kind}:${s.id}` === share) ?? null;
      const result = await createPost({
        channel: target,
        body,
        share: picked ? { kind: picked.kind, id: picked.id } : null,
      });
      if (!result.ok) return setError(result.error);
      setBody("");
      setShare("");
      router.refresh();
    });

  return (
    <Card className="min-w-0">
      <Textarea
        aria-label="Skriv ett inlägg"
        rows={3}
        placeholder="Vad har du tränat, testat eller undrar över?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Kanal"
          value={target}
          onChange={(e) => setTarget(e.target.value as CommunityChannel)}
          className="w-auto"
        >
          {CHANNELS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
        {shareables.length > 0 && (
          <Select
            aria-label="Dela ett pass eller test"
            value={share}
            onChange={(e) => setShare(e.target.value)}
            className="w-auto min-w-0 max-w-full flex-1"
          >
            <option value="">Dela ett pass eller test …</option>
            {shareables.map((s) => (
              <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
        <Button type="button" onClick={publish} disabled={pending || !body.trim()} className="ml-auto">
          {pending ? "Publicerar …" : "Publicera"}
        </Button>
      </div>
      {error && <p className="mt-2 text-[13px] text-text">{error}</p>}
    </Card>
  );
}

export function CommunityFeed({
  channel,
  initialPosts,
  hasMore: initialHasMore,
  shareables,
  me,
}: {
  channel: CommunityChannel | null;
  initialPosts: CommunityFeedItem[];
  hasMore: boolean;
  shareables: Shareable[];
  me: Me;
}) {
  const [extra, setExtra] = useState<CommunityFeedItem[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, start] = useTransition();

  const posts = [...initialPosts, ...extra].filter((p) => !removed.includes(p.id));

  const more = () =>
    start(async () => {
      const last = posts[posts.length - 1];
      if (!last) return;
      const next = await loadMore(channel, last.created_at);
      setExtra((e) => [...e, ...next]);
      setHasMore(next.length > 0);
    });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav aria-label="Kanaler" className="flex flex-wrap gap-1.5">
        {[{ key: null, label: "Alla" }, ...CHANNELS].map((c) => (
          <Link
            key={c.key ?? "alla"}
            href={c.key ? `${routes.community}?kanal=${c.key}` : routes.community}
            aria-current={channel === c.key ? "page" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[13px] transition-colors",
              channel === c.key
                ? "border-text-subtle bg-surface-3 font-medium text-text"
                : "border-line-strong text-text-muted hover:border-accent hover:text-text",
            )}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      <Composer channel={channel} shareables={shareables} />

      {posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-6 py-10 text-center text-sm text-text-muted">
          Inga inlägg här än. Bli först!
        </p>
      ) : (
        posts.map((post) => (
          <Post
            key={post.id}
            post={post}
            me={me}
            onDeleted={() => setRemoved((r) => [...r, post.id])}
          />
        ))
      )}

      {hasMore && posts.length > 0 && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={more} disabled={pending}>
            {pending ? "Hämtar …" : "Visa fler"}
          </Button>
        </div>
      )}
    </div>
  );
}
