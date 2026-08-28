import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Rubrikblocket överst på varje verktygssida. */
export function ToolHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-10 print:hidden">
      <Link
        href="/verktyg"
        className="inline-flex items-center gap-1.5 text-sm text-text-subtle transition-colors hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Verktyg
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-text-muted">
        {description}
      </p>
    </div>
  );
}
