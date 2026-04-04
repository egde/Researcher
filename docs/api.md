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

## Companies

### `GET /api/companies`

Paginated company listing with search, filter, and sort.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Case-insensitive name search (contains) |
| `sectorId` | string | Filter by sector |
| `regionId` | string | Filter by region (via sector) |
| `letter` | string | Filter by first letter of name |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 50, max: 100) |

**Response:**
```json
{
  "companies": [
    {
      "id": "cuid",
      "name": "Apple Inc",
      "slug": "apple",
      "sector": { "name": "Technology", "region": { "name": "North America", "slug": "north-america" } },
      "_count": { "documents": 5, "votes": 3 }
    }
  ],
  "total": 250,
  "page": 1,
  "limit": 50,
  "totalPages": 5
}
```

### `POST /api/companies`

Create a new company. Requires authentication.

**Request body:**
```json
{
  "name": "Acme Corp",
  "sectorId": "sector-cuid"
}
```

**Response:** `201` with the created company object including sector and region.

### `PUT /api/companies/[slug]`

Update a company's name or sector. Requires authentication.

**Request body:**
```json
{
  "name": "New Name",
  "sectorId": "new-sector-cuid"
}
```

### `DELETE /api/companies/[slug]`

Delete a company. Fails with `409` if the company has associated documents or votes. Requires authentication.

### `GET /api/companies/search`

Lightweight typeahead search returning only `id`, `name`, `slug`. Used by the DocumentForm company picker.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search by name (min 1 char) |
| `ids` | string | Comma-separated IDs to resolve (for edit mode) |

**Response:** Array of `{ id, name, slug }` objects (max 20 results for search).

---

## Regions

### `GET /api/regions`

List all regions with sector counts.

**Response:**
```json
[
  { "id": "cuid", "name": "North America", "slug": "north-america", "_count": { "sectors": 4 } }
]
```

### `POST /api/regions`

Create a new region. Requires authentication.

**Request body:**
```json
{ "name": "Latin America" }
```

---

## Sectors

### `GET /api/sectors`

List sectors with region info and company counts.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `regionId` | string | Filter by region |

**Response:**
```json
[
  {
    "id": "cuid",
    "name": "Technology",
    "slug": "technology",
    "region": { "id": "cuid", "name": "North America", "slug": "north-america" },
    "_count": { "companies": 8 }
  }
]
```

### `POST /api/sectors`

Create a new sector. Requires authentication.

**Request body:**
```json
{ "name": "Industrials", "regionId": "region-cuid" }
```

### `PUT /api/sectors/[slug]`

Rename a sector. Requires authentication.

**Request body:**
```json
{ "name": "New Sector Name" }
```

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

## Ingest

All ingest endpoints require `Authorization: Bearer <apiKey>` header.

### `POST /api/documents/ingest`

Obsidian plugin endpoint. Upserts by title + author — publishing the same note again updates the existing document.

**Request body:**
```json
{
  "title": "Apple Q4 Deep Dive",
  "type": "COMPANY_RESEARCH",
  "companies": ["Apple Inc", "Microsoft"],
  "tags": ["tech", "earnings"],
  "content": "# Markdown content..."
}
```

- `companies`: array of company names, resolved case-insensitively against the database
- `tags`: array of tag names, auto-created if they don't exist

**Response:**
```json
{ "slug": "apple-q4-deep-dive", "url": "/documents/apple-q4-deep-dive" }
```

### `POST /api/documents/ingest/batch`

Databricks batch ingest endpoint. **Requires ADMIN role.** Up to 100 documents per request. Each document is upserted by `sourceRef` — safe to re-run.

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

**Response:**
```json
{
  "summary": { "total": 3, "created": 2, "updated": 1, "errors": 0 },
  "results": [
    { "sourceRef": "...", "slug": "...", "status": "created" },
    { "sourceRef": "...", "slug": "...", "status": "updated" }
  ]
}
```

---

## Upload

### `POST /api/upload`

PDF upload with text extraction. Supports both session auth and API key auth. Multipart form data.

**Form fields:**

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | PDF file (required, max 20MB) |
| `title` | string | Document title (defaults to filename) |
| `type` | string | Document type (defaults to `BROKER_RESEARCH`) |
| `companies` | string | Comma-separated company names |
| `tags` | string | Comma-separated tag names |

**Response:** `201` with `{ slug, title, url }`

---

## Votes

### `GET /api/votes`

Get conviction votes for a company.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `companyId` | string | **Required.** Company to get votes for |

**Response:**
```json
{
  "votes": [
    {
      "id": "cuid",
      "conviction": 4,
      "rationale": "Strong moat, improving margins",
      "createdAt": "2026-04-03T12:00:00.000Z",
      "updatedAt": "2026-04-04T08:00:00.000Z",
      "user": { "id": "cuid", "name": "Alice Chen" }
    }
  ],
  "avg": 3.8,
  "count": 5
}
```

### `POST /api/votes`

Upsert a conviction vote. One vote per user per company (enforced by unique constraint). Requires authentication.

**Request body:**
```json
{
  "companyId": "company-cuid",
  "conviction": 4,
  "rationale": "Strong moat, improving margins"
}
```

- `conviction`: integer 1-5 (required)
- `rationale`: string (optional)

**Response:** The created/updated vote object with user info.

---

## Planned Endpoints (not yet implemented)

| Endpoint | Phase | Purpose |
|----------|-------|---------|
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
