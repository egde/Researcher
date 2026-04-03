# Database Schema

## Entity Relationship Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Region  │────→│  Sector  │────→│ Company  │
└──────────┘  1:N└──────────┘  1:N└──────────┘
                                     │    │
                              DocumentCompany│
                                (M:N) │    │
                                      │    │ Vote
                                      │    │ (1 per user+company)
                                      ▼    ▼
                  ┌──────────┐     ┌──────────┐
                  │   User   │────→│   Vote   │
                  └──────────┘  1:N└──────────┘
                     │ 1:N
                     ▼
                  ┌──────────┐     ┌──────────┐
                  │ Document │←───→│   Tag    │  (M:N via DocumentTag)
                  └──────────┘     └──────────┘
                     │
          ┌──────────┼──────────┬──────────┐
          ▼          ▼          ▼          ▼
      ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
      │Comment │ │Reaction│ │DocLink │ │DocumentCompany│
      └────────┘ └────────┘ └────────┘ └──────────────┘
         │ self-ref
         └→ replies
```

## Models

### User

| Column | Type | Notes |
|--------|------|-------|
| id | String (CUID) | Primary key |
| name | String | Display name |
| email | String | Unique, login identifier |
| passwordHash | String | bcrypt hash |
| role | Enum | ANALYST, SENIOR_ANALYST, ADMIN |
| apiKey | String? | Unique, for Obsidian plugin auth |

### Region → Sector → Company

Three-level hierarchy. Each entity has a unique `name` and `slug`.

- Region: North America, Europe, Asia Pacific
- Sector: Technology, Healthcare, Financials, Energy, etc.
- Company: Apple, NVIDIA, JPMorgan, etc.

### Document

| Column | Type | Notes |
|--------|------|-------|
| id | String (CUID) | Primary key |
| slug | String | Unique, URL-friendly |
| title | String | Display title |
| content | String | Raw markdown (source of truth) |
| type | Enum | COMPANY_RESEARCH, BROKER_RESEARCH, NEWS, etc. |
| source | String | `web`, `obsidian`, or `databricks` |
| sourceRef | String? | External reference (e.g., Databricks Silver layer path) |
| authorId | String | FK → User |

**Indexes:** `type`, `source`

### DocumentCompany (M:N join)

Composite PK: `(documentId, companyId)`. Cascades on document delete.

### Vote

One conviction per analyst per company (enforced by unique constraint on `userId + companyId`).

| Column | Type | Notes |
|--------|------|-------|
| conviction | Int | 1-5 scale |
| rationale | String? | Optional justification |

### Comment

Self-referential for threading: `parentId` points to parent comment. Top-level comments have `parentId = null`.

### Reaction

Unique constraint on `(userId, documentId, emoji)` — one reaction type per user per document. Emoji values: `thumbsup`, `fire`, `eyes`, `rocket`, `heart`.

### DocumentLink

Tracks wiki-style links between documents for backlink support. `sourceDocId → targetDocId`. Unique constraint prevents duplicate links.

## Migrations

Migrations are in `prisma/migrations/`. Run with:

```bash
npx prisma migrate dev          # Development (creates shadow DB)
npx prisma migrate deploy       # Production (no shadow DB)
```

## Seeding

```bash
npx tsx prisma/seed.ts
```

Seeds 3 regions, 7 sectors, 20 companies, 15 tags, 3 demo users, 3 demo documents with company associations and conviction votes. Idempotent (uses upserts).

## Prisma 7 Client Usage

```typescript
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

The singleton instance is in `src/lib/prisma.ts` with HMR-safe global caching.
