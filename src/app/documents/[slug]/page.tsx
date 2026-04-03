export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { RelatedSidebar } from "@/components/documents/RelatedSidebar";
import { SourceBadge } from "@/components/companies/SourceBadge";
import { Badge } from "@/components/ui/Badge";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const document = await prisma.document.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, email: true } },
      companies: { include: { company: true } },
      tags: { include: { tag: true } },
      comments: {
        where: { parentId: null },
        include: {
          user: { select: { id: true, name: true } },
          replies: {
            include: { user: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      reactions: true,
      incomingLinks: {
        include: {
          sourceDoc: { select: { id: true, slug: true, title: true } },
        },
      },
    },
  });

  if (!document) notFound();

  // Fetch related documents
  const companyIds = document.companies.map((dc) => dc.companyId);
  const tagIds = document.tags.map((dt) => dt.tagId);

  const orConditions = [
    ...(companyIds.length ? [{ companies: { some: { companyId: { in: companyIds } } } }] : []),
    ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : []),
  ];

  const related = orConditions.length > 0
    ? await prisma.document.findMany({
        where: {
          id: { not: document.id },
          OR: orConditions,
        },
        select: { id: true, slug: true, title: true, type: true, source: true, createdAt: true },
        take: 10,
        orderBy: { createdAt: "desc" },
      })
    : [];

  const html = await renderMarkdown(document.content);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-[1fr_240px] gap-8">
        {/* Main content */}
        <div>
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <SourceBadge source={document.source} />
              <Badge variant="muted">
                {document.type.replace(/_/g, " ").toLowerCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-bold">{document.title}</h1>
              <Link
                href={`/documents/${slug}/edit`}
                className="text-[10px] uppercase tracking-wider text-muted no-underline hover:text-foreground"
              >
                Edit
              </Link>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span>{document.author.name}</span>
              <span>{formatDate(document.createdAt)}</span>
              {document.sourceRef && (
                <span className="text-[10px]">ref: {document.sourceRef}</span>
              )}
            </div>
            {document.tags.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                {document.tags.map((dt) => (
                  <Badge key={dt.tagId} variant="muted">
                    {dt.tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Body */}
          <DocumentViewer html={html} />

          {/* Comments section */}
          {document.comments.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <h2 className="text-[10px] uppercase tracking-wider text-muted mb-4">
                Comments ({document.comments.length})
              </h2>
              <div className="space-y-4">
                {document.comments.map((comment) => (
                  <div key={comment.id} className="border-l-2 border-border pl-3">
                    <div className="text-[10px] text-muted mb-1">
                      {comment.user.name} &middot;{" "}
                      {formatDate(comment.createdAt)}
                    </div>
                    <div className="text-sm">{comment.content}</div>
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="ml-4 mt-2 border-l border-border pl-3">
                        <div className="text-[10px] text-muted mb-1">
                          {reply.user.name} &middot;{" "}
                          {formatDate(reply.createdAt)}
                        </div>
                        <div className="text-sm">{reply.content}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <RelatedSidebar
          companies={document.companies}
          related={related}
          backlinks={document.incomingLinks}
        />
      </div>
    </div>
  );
}
