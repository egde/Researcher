import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DocumentForm } from "@/components/editor/DocumentForm";

export const dynamic = "force-dynamic";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const document = await prisma.document.findUnique({
    where: { slug },
    include: {
      companies: { select: { companyId: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!document) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-base font-bold uppercase tracking-wider mb-6">
        Edit Document
      </h1>
      <DocumentForm
        mode="edit"
        slug={slug}
        initialData={{
          title: document.title,
          type: document.type,
          content: document.content,
          companyIds: document.companies.map((c) => c.companyId),
          tags: document.tags.map((t) => t.tag.name),
        }}
      />
    </div>
  );
}
