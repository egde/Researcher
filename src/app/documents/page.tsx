import { prisma } from "@/lib/prisma";
import { DocumentCard } from "@/components/documents/DocumentCard";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; source?: string }>;
}) {
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (params.type) where.type = params.type;
  if (params.source) where.source = params.source;

  const documents = await prisma.document.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, email: true } },
      companies: { include: { company: true } },
      tags: { include: { tag: true } },
      _count: { select: { comments: true, reactions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const types = [
    "COMPANY_RESEARCH",
    "SECTOR_ANALYSIS",
    "REGION_ANALYSIS",
    "BROKER_RESEARCH",
    "NEWS",
    "EARNINGS_TRANSCRIPT",
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-base font-bold uppercase tracking-wider">Documents</h1>
        <div className="flex items-center gap-2">
          <FilterLink href="/documents" label="ALL" active={!params.type && !params.source} />
          <FilterLink
            href="/documents?source=databricks"
            label="EXTERNAL"
            active={params.source === "databricks"}
          />
          <FilterLink
            href="/documents?source=obsidian"
            label="RESEARCH"
            active={params.source === "obsidian"}
          />
          <FilterLink
            href="/documents?source=web"
            label="INTERNAL"
            active={params.source === "web"}
          />
        </div>
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {types.map((t) => (
          <FilterLink
            key={t}
            href={`/documents?type=${t}`}
            label={t.replace(/_/g, " ")}
            active={params.type === t}
            small
          />
        ))}
      </div>

      <div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted py-8">No documents found.</p>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              slug={doc.slug}
              title={doc.title}
              type={doc.type}
              source={doc.source}
              authorName={doc.author.name}
              createdAt={doc.createdAt.toISOString()}
              companies={doc.companies}
              commentCount={doc._count.comments}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
  small,
}: {
  href: string;
  label: string;
  active: boolean;
  small?: boolean;
}) {
  return (
    <a
      href={href}
      className={`${small ? "text-[9px]" : "text-[10px]"} uppercase tracking-wider no-underline px-2 py-1 ${
        active
          ? "text-background bg-foreground"
          : "text-muted border border-border hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </a>
  );
}
