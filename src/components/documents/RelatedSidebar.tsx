import Link from "next/link";

interface RelatedDoc {
  id: string;
  slug: string;
  title: string;
  type: string;
  source: string;
}

interface BacklinkDoc {
  sourceDoc: { id: string; slug: string; title: string };
}

interface Company {
  company: { name: string; slug: string };
}

interface RelatedSidebarProps {
  companies: Company[];
  related: RelatedDoc[];
  backlinks: BacklinkDoc[];
}

export function RelatedSidebar({ companies, related, backlinks }: RelatedSidebarProps) {
  return (
    <aside className="border-l border-border pl-6 space-y-6">
      {companies.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">
            Companies
          </h3>
          <ul className="space-y-1">
            {companies.map((dc) => (
              <li key={dc.company.slug}>
                <Link
                  href={`/companies/${dc.company.slug}`}
                  className="text-xs text-link no-underline hover:underline"
                >
                  {dc.company.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {backlinks.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">
            Backlinks
          </h3>
          <ul className="space-y-1">
            {backlinks.map((bl) => (
              <li key={bl.sourceDoc.id}>
                <Link
                  href={`/documents/${bl.sourceDoc.slug}`}
                  className="text-xs text-link no-underline hover:underline"
                >
                  {bl.sourceDoc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {related.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">
            Related
          </h3>
          <ul className="space-y-1">
            {related.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/documents/${doc.slug}`}
                  className="text-xs text-link no-underline hover:underline"
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
