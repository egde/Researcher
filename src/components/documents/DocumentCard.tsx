import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { SourceBadge } from "@/components/companies/SourceBadge";

interface DocumentCardProps {
  slug: string;
  title: string;
  type: string;
  source: string;
  authorName: string;
  createdAt: string;
  companies: { company: { name: string; slug: string } }[];
  commentCount?: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatType(type: string) {
  return type.replace(/_/g, " ").toLowerCase();
}

export function DocumentCard({
  slug,
  title,
  type,
  source,
  authorName,
  createdAt,
  companies,
  commentCount = 0,
}: DocumentCardProps) {
  return (
    <article className="border-b border-border py-3 group">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/documents/${slug}`}
            className="text-sm font-medium no-underline text-foreground group-hover:opacity-70"
          >
            {title}
          </Link>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <SourceBadge source={source} />
            <Badge variant="muted">{formatType(type)}</Badge>
            {companies.slice(0, 3).map((dc) => (
              <Link
                key={dc.company.slug}
                href={`/companies/${dc.company.slug}`}
                className="text-[10px] text-link no-underline hover:underline"
              >
                {dc.company.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted">{formatDate(createdAt)}</div>
          <div className="text-[10px] text-muted">{authorName}</div>
          {commentCount > 0 && (
            <div className="text-[10px] text-muted">{commentCount} comments</div>
          )}
        </div>
      </div>
    </article>
  );
}
