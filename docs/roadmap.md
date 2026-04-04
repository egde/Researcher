# Implementation Roadmap

## Phase 1 — Project Scaffold + Document Model (COMPLETE)

- [x] Next.js 16 with App Router, TypeScript, Tailwind CSS v4
- [x] Prisma 7 schema: 11 models (User, Document, Company, Sector, Region, Vote, Tag, Comment, Reaction, DocumentLink, DocumentCompany)
- [x] PostgreSQL migrations and seed data (3 regions, 7 sectors, 20 companies, 3 users, 3 demo documents)
- [x] Lib utilities: prisma client, markdown renderer, slugify, wiki-link parser
- [x] API routes: `GET/POST /api/documents`, `GET/PUT/DELETE /api/documents/[slug]`, `GET /api/search`, `GET /api/companies`
- [x] Dashboard page: activity feed, top convictions, recent votes
- [x] Documents list page with source/type filters
- [x] Document reader with clean markdown rendering + related sidebar + backlinks
- [x] Companies list grouped by region/sector
- [x] Company detail page with timeline, conviction votes, AI summary placeholder
- [x] Navbar with persistent search bar (debounced, instant results dropdown)
- [x] HistoryRail (session-scoped page visit tracking)
- [x] UI primitives: Badge (3 variants), Button (3 variants), Card, Input
- [x] SourceBadge component (external/internal/research distinction)

## Phase 2 — Auth + Rich Editor (COMPLETE)

- [x] NextAuth v5 credentials provider
- [x] Login page + route protection middleware
- [x] API key generation for users (Obsidian plugin auth)
- [x] Tiptap WYSIWYG rich editor component
- [x] Frontmatter form (title, type, company multi-select, tags)
- [x] `/documents/new` and `/documents/[slug]/edit` pages
- [x] On save: parse `[[wiki-links]]` in content, populate DocumentLink table

## Phase 3 — Conviction Voting + Company Pages (PARTIALLY COMPLETE)

- [x] Companies page: paginated directory with search, region/sector filters, A-Z strip
- [x] Company CRUD API: `GET/POST /api/companies`, `PUT/DELETE /api/companies/[slug]`
- [x] Company search API: `GET /api/companies/search` (typeahead)
- [x] Regions API: `GET/POST /api/regions`
- [x] Sectors API: `GET/POST /api/sectors`, `PUT /api/sectors/[slug]`
- [x] Dashboard: optimized top convictions via SQL aggregation
- [x] RelatedSidebar: capped at 10 companies with overflow
- [x] DocumentForm: typeahead company picker (replaces 20K toggle buttons)
- [x] Mobile-responsive layout: hamburger nav, stacking filters, scrollable tables
- [x] Database indexes on Company (name, sectorId)
- [ ] ConvictionVoter component (1-5 clickable scale + rationale)
- [ ] `POST /api/votes` (upsert per user+company)
- [ ] `GET /api/votes?companyId=X`
- [ ] VoteSummary component (avg conviction, per-analyst breakdown)
- [ ] ConvictionHeatmap (companies x analysts grayscale grid)
- [ ] `/votes` heatmap page

## Phase 4 — Ingest APIs + Obsidian Plugin

- [ ] `POST /api/documents/ingest` — API key auth, upsert by title+author
- [ ] `POST /api/documents/ingest/batch` — service key auth, bulk upsert by sourceRef
- [ ] Obsidian plugin: settings (API URL, API key)
- [ ] Obsidian plugin: "Publish to Wiki" command
- [ ] Obsidian plugin: "Pull from Wiki" command
- [ ] PDF upload endpoint (`POST /api/upload`) as manual fallback

## Phase 5 — Hierarchy Browsing + Search (PARTIALLY COMPLETE)

- [x] `GET /api/sectors` and `GET /api/regions` endpoints
- [ ] `/sectors/[slug]` and `/regions/[slug]` pages
- [ ] PostgreSQL tsvector full-text search replacing current ILIKE
- [ ] Tag filtering on documents page
- [ ] Enhanced search bar with category grouping

## Phase 6 — Social Features + Dashboard

- [ ] Threaded comments (CommentThread, CommentForm, `POST /api/comments`)
- [ ] Emoji reactions (`POST /api/reactions`, toggle per user+doc+emoji)
- [ ] Dashboard: ActivityFeed, TopMovers, MyActivity (personalized)
- [ ] `/graph` page: d3-force network visualization of documents and companies
- [ ] Error boundaries
- [ ] Admin user management (create accounts, manage API keys)

## Future

- [ ] LLM-generated company summaries (replace placeholder)
- [ ] Research Agent (RAG over wiki content)
- [ ] Databricks Lakehouse integration (Option B/C migration path)
- [ ] Real-time collaboration on documents
- [ ] Email/Slack notifications for conviction changes
