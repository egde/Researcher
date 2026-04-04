export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { SourceBadge } from "@/components/companies/SourceBadge";
import { VoteSummary } from "@/components/votes/VoteSummary";
import { ConvictionVoterWrapper } from "@/components/votes/ConvictionVoterWrapper";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [company, session] = await Promise.all([
    prisma.company.findUnique({
      where: { slug },
      include: {
        sector: {
          include: { region: { select: { name: true, slug: true } } },
        },
        documents: {
          include: {
            document: {
              include: {
                author: { select: { id: true, name: true } },
                tags: { include: { tag: true } },
              },
            },
          },
          orderBy: { document: { createdAt: "desc" } },
        },
        votes: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    auth(),
  ]);

  if (!company) notFound();

  const currentUserVote = session?.user?.id
    ? company.votes.find((v) => v.user.id === session.user.id)
    : undefined;

  // Separate external vs internal documents
  const externalDocs = company.documents.filter(
    (dc) => dc.document.source === "databricks"
  );
  const internalDocs = company.documents.filter(
    (dc) => dc.document.source !== "databricks"
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[10px] text-muted uppercase tracking-wider mb-1">
          <Link href={`/companies`} className="text-link no-underline hover:underline">
            {company.sector.region.name}
          </Link>
          {" / "}
          {company.sector.name}
        </div>
        <h1 className="text-lg font-bold">{company.name}</h1>
      </div>

      {/* LLM Summary Placeholder */}
      <div className="border border-border bg-surface p-4 mb-6">
        <div className="text-[10px] uppercase tracking-wider text-muted mb-2">
          AI Summary
        </div>
        <p className="text-xs text-muted italic">
          AI-generated summary will appear here in a future update, synthesizing all available research for {company.name}.
        </p>
      </div>

      {/* Vote summary */}
      <VoteSummary votes={company.votes} />

      {/* Conviction voter */}
      <ConvictionVoterWrapper
        companyId={company.id}
        companyName={company.name}
        existingVote={
          currentUserVote
            ? { conviction: currentUserVote.conviction, rationale: currentUserVote.rationale }
            : undefined
        }
      />

      {/* Timeline — Internal Research */}
      <div className="mb-6 mt-6">
        <h2 className="text-[10px] uppercase tracking-wider text-muted mb-3">
          Research ({internalDocs.length})
        </h2>
        {internalDocs.length === 0 ? (
          <p className="text-xs text-muted">No internal research yet.</p>
        ) : (
          <div className="space-y-2">
            {internalDocs.map((dc) => (
              <TimelineItem key={dc.document.id} doc={dc.document} />
            ))}
          </div>
        )}
      </div>

      {/* Timeline — External Sources */}
      <div>
        <h2 className="text-[10px] uppercase tracking-wider text-muted mb-3">
          External Sources ({externalDocs.length})
        </h2>
        {externalDocs.length === 0 ? (
          <p className="text-xs text-muted">No external documents ingested.</p>
        ) : (
          <div className="space-y-2">
            {externalDocs.map((dc) => (
              <TimelineItem key={dc.document.id} doc={dc.document} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineItem({
  doc,
}: {
  doc: {
    id: string;
    slug: string;
    title: string;
    type: string;
    source: string;
    createdAt: Date;
    author: { name: string };
    tags: { tag: { name: string } }[];
  };
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border">
      <div className="text-[10px] text-muted w-20 shrink-0 pt-0.5">
        {formatDate(doc.createdAt)}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <SourceBadge source={doc.source} />
          <Link
            href={`/documents/${doc.slug}`}
            className="text-xs text-link no-underline hover:underline truncate"
          >
            {doc.title}
          </Link>
        </div>
        <div className="text-[10px] text-muted mt-0.5">
          {doc.author.name}
          {doc.tags.length > 0 && (
            <span className="ml-2">
              {doc.tags.map((dt) => dt.tag.name).join(", ")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
