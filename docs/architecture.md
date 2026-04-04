# Architecture

## System Overview

The Research Wiki is a Next.js 16 application backed by PostgreSQL. It serves as the central knowledge base for an investment research team, aggregating content from three sources into a single browsable, searchable wiki.

```
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION PATHS                           │
├─────────────────┬─────────────────────┬─────────────────────┤
│                 │                     │                      │
│  1. Databricks  │  2. Obsidian        │  3. Web UI           │
│  Silver Layer   │  Plugin             │  Rich Editor         │
│                 │                     │                      │
│  Broker PDFs    │  Analyst's private  │  Quick edits,        │
│  Earnings txs   │  research notes     │  collaborative       │
│  News articles  │  "Publish to Wiki"  │  documents           │
│  SEC filings    │  command            │                      │
│                 │                     │                      │
│  POST /api/     │  POST /api/         │  POST /api/          │
│  documents/     │  documents/         │  documents           │
│  ingest/batch   │  ingest             │                      │
└────────┬────────┴──────────┬──────────┴──────────┬──────────┘
         │                   │                      │
         └───────────────────┼──────────────────────┘
                             ▼
                    PostgreSQL DB
                  (single source of truth)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Web Wiki      Obsidian        Research Agent
         (browse,      (pull content   (future — RAG)
          vote,         back to vault)
          comment)
```

### Path 1: Databricks Silver Layer (automated)

Raw documents (broker PDFs, earnings transcripts, news, SEC filings) are ingested into a Databricks storage volume. An Auto Loader job extracts text and images, producing markdown files in the Silver layer. A scheduled job calls `POST /api/documents/ingest/batch` to push processed markdown into the wiki database. Each document carries metadata including source type, associated companies, and the original file reference (`sourceRef`).

### Path 2: Obsidian Plugin (analyst-initiated)

Analysts write private research notes in Obsidian vaults with YAML frontmatter (title, type, companies, tags). When ready to share, they run the "Publish to Wiki" command, which POSTs the note to `POST /api/documents/ingest`. The plugin authenticates via a per-user API key.

### Path 3: Web UI (browser-based)

A Tiptap WYSIWYG editor (Phase 2) allows creating and editing documents directly in the browser. Content is saved as markdown to the database via `POST /api/documents`.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2 |
| Language | TypeScript | 5.x |
| UI | React Server Components + Client Components | 19.x |
| Styling | Tailwind CSS v4 (CSS-based config) | 4.x |
| ORM | Prisma with `@prisma/adapter-pg` | 7.6 |
| Database | PostgreSQL | 16 |
| Auth | NextAuth v5 (beta) | Phase 2 |
| Markdown | unified + remark + rehype pipeline | 11.x |
| Validation | Zod | 4.x |

## Data Model

```
Region (1) ──→ (N) Sector (1) ──→ (N) Company
                                        │
                                   DocumentCompany (M:N)
                                        │
Document ←── DocumentTag (M:N) ──→ Tag
    │
    ├── Comment (threaded via parentId self-relation)
    ├── Reaction (unique per user+doc+emoji)
    └── DocumentLink (source → target, for backlinks)

User ──→ Document (author)
User ──→ Vote (one per user+company, 1-5 conviction scale)
User ──→ Comment
User ──→ Reaction
```

### Key Design Decisions

- **Documents link to companies via a many-to-many join table** (`DocumentCompany`). A broker report can cover multiple companies.
- **Convictions are per-company, not per-document.** Each analyst casts one 1-5 vote per company, with an optional rationale.
- **Source separation**: Documents have a `source` field (`web`, `obsidian`, `databricks`) and an optional `sourceRef` for tracing back to the original file.
- **Backlinks**: `DocumentLink` tracks when one document references another via `[[wiki-link]]` syntax. The target document can display its incoming links.
- **Threaded comments**: Comments have a nullable `parentId` self-relation for nested replies.

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard (activity feed, convictions)
│   ├── layout.tsx                # Root layout (Navbar, HistoryRail)
│   ├── globals.css               # Tailwind + design system tokens
│   ├── api/                      # API route handlers
│   │   ├── documents/            # CRUD + ingest endpoints
│   │   ├── companies/            # Paginated list, CRUD, typeahead search
│   │   ├── regions/              # Region list + create
│   │   ├── sectors/              # Sector list, create, rename
│   │   └── search/               # Full-text search
│   ├── documents/                # Document list + reader + editor pages
│   └── companies/                # Company directory + detail pages
├── components/
│   ├── layout/                   # Navbar (responsive, hamburger on mobile)
│   ├── documents/                # DocumentCard, DocumentViewer, RelatedSidebar
│   ├── companies/                # SourceBadge, CompanyDirectory
│   ├── editor/                   # Editor (Tiptap), DocumentForm (typeahead picker)
│   ├── search/                   # SearchBar with instant results
│   └── ui/                       # Badge, Button, Card, Input
├── hooks/
│   └── useDebounce.ts            # Generic debounce hook
├── lib/
│   ├── prisma.ts                 # Singleton Prisma client with PG adapter
│   ├── auth.ts                   # NextAuth v5 config
│   ├── markdown.ts               # remark/rehype render pipeline
│   ├── slugify.ts                # URL slug generation
│   ├── links.ts                  # [[wiki-link]] parser
│   └── types.ts                  # Shared TypeScript types
prisma/
├── schema.prisma                 # Full database schema (11 models)
├── seed.ts                       # Demo data seeder
└── migrations/                   # PostgreSQL migrations
```

## Prisma 7 Notes

This project uses Prisma 7, which differs from earlier versions:

- **No `url` in `schema.prisma`**: The database URL is configured in `prisma.config.ts`, not in the schema file.
- **Adapter-based client**: `PrismaClient` requires a `@prisma/adapter-pg` adapter with a `pg.Pool` connection. See `src/lib/prisma.ts`.
- **Generated output**: Client is generated to `src/generated/prisma/` (gitignored). Run `npx prisma generate` after cloning.
- **Import path**: Import from `@/generated/prisma/client`, not `@prisma/client`.
