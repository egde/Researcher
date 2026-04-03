# API Reference

All API routes are under `/api/`. Responses are JSON.

## Documents

### `GET /api/documents`

List documents with optional filters.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by `DocumentType` enum value |
| `companyId` | string | Filter by associated company |
| `source` | string | Filter by source: `web`, `obsidian`, `databricks` |
| `limit` | number | Max results (default: 50) |
| `offset` | number | Pagination offset (default: 0) |

**Response:**
```json
{
  "documents": [
    {
      "id": "cuid",
      "slug": "apple-q4-2025-analysis",
      "title": "Apple Q4 2025 Earnings Analysis",
      "type": "COMPANY_RESEARCH",
      "source": "obsidian",
      "sourceRef": null,
      "createdAt": "2026-04-03T12:00:00.000Z",
      "author": { "id": "cuid", "name": "Alice Chen", "email": "alice@fund.com" },
      "companies": [{ "companyId": "cuid", "company": { "name": "Apple Inc", "slug": "apple" } }],
      "tags": [{ "tagId": "cuid", "tag": { "name": "earnings" } }],
      "_count": { "comments": 2, "reactions": 5 }
    }
  ],
  "total": 42
}
```

### `POST /api/documents`

Create a document via the web editor.

**Request body:**
```json
{
  "title": "My Research Note",
  "content": "# Heading\n\nMarkdown content...",
  "type": "COMPANY_RESEARCH",
  "authorId": "user-cuid",
  "companyIds": ["company-cuid-1", "company-cuid-2"],
  "tags": ["earnings", "megacap"]
}
```

Tags are upserted by name. Slug is auto-generated from title.

**Response:** `201` with the created document object.

### `GET /api/documents/[slug]`

Fetch a single document with full relations: author, companies, tags, threaded comments, reactions, backlinks (incoming document links), and related documents (same companies or tags).

**Response:** Document object plus:
```json
{
  "...document fields",
  "comments": [
    {
      "id": "cuid",
      "content": "Great analysis",
      "user": { "id": "cuid", "name": "Bob" },
      "replies": [{ "..." }]
    }
  ],
  "reactions": [{ "id": "cuid", "emoji": "thumbsup", "userId": "cuid" }],
  "incomingLinks": [{ "sourceDoc": { "id": "cuid", "slug": "...", "title": "..." } }],
  "related": [{ "id": "cuid", "slug": "...", "title": "...", "type": "...", "source": "..." }]
}
```

### `PUT /api/documents/[slug]`

Update a document's title, content, or type.

### `DELETE /api/documents/[slug]`

Delete a document and all associated relations (cascading).

---

## Ingest (Phase 4 — not yet implemented)

### `POST /api/documents/ingest`

Obsidian plugin endpoint. Auth via `Authorization: Bearer <apiKey>`.

**Request body:**
```json
{
  "title": "Apple Q4 Deep Dive",
  "type": "company_research",
  "companies": ["Apple Inc", "Microsoft"],
  "tags": ["tech", "earnings"],
  "content": "# Markdown content..."
}
```

Upserts by title + author. Returns `{ slug, url }`.

### `POST /api/documents/ingest/batch`

Databricks batch ingest endpoint. Auth via service API key.

**Request body:**
```json
{
  "documents": [
    {
      "title": "JPMorgan Credit Outlook",
      "type": "BROKER_RESEARCH",
      "companies": ["JPMorgan Chase"],
      "tags": ["credit"],
      "content": "# Markdown...",
      "sourceRef": "silver/broker-research/jpmorgan/credit-outlook.md"
    }
  ]
}
```

Bulk upserts by `sourceRef`. Idempotent — safe to re-run.

---

## Search

### `GET /api/search?q=...`

Full-text search across documents and companies. Requires minimum 2 characters.

**Response:**
```json
{
  "documents": [
    { "id": "...", "slug": "...", "title": "...", "type": "...", "source": "...", "author": { "name": "..." } }
  ],
  "companies": [
    { "id": "...", "slug": "...", "name": "...", "sector": { "name": "..." } }
  ]
}
```

Currently uses `ILIKE` pattern matching. Phase 5 will add PostgreSQL `tsvector` full-text search.

---

## Companies

### `GET /api/companies`

List all companies with sector and region info.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `sectorId` | string | Filter by sector |

**Response:** Array of company objects with `sector.region`, `_count.documents`, `_count.votes`.

---

## Planned Endpoints (not yet implemented)

| Endpoint | Phase | Purpose |
|----------|-------|---------|
| `POST /api/votes` | 3 | Upsert conviction vote |
| `GET /api/votes?companyId=X` | 3 | Get votes for a company |
| `GET /api/sectors` | 5 | List sectors |
| `GET /api/regions` | 5 | List regions |
| `GET/POST /api/comments` | 6 | Threaded comments |
| `POST /api/reactions` | 6 | Toggle emoji reaction |
| `GET /api/graph` | 6 | Graph visualization data |
| `POST /api/upload` | 4 | Manual PDF upload |

## Document Types

```
COMPANY_RESEARCH      — Analyst note on a specific company
SECTOR_ANALYSIS       — Cross-company sector view
REGION_ANALYSIS       — Regional macro analysis
BROKER_RESEARCH       — External broker report (typically from Databricks)
NEWS                  — News article
EARNINGS_TRANSCRIPT   — Quarterly earnings call transcript
```
