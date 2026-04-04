# Research Wiki — Obsidian Plugin

Publish and pull research notes between your Obsidian vault and the Research Wiki.

## Setup

1. Copy this plugin folder into your vault's `.obsidian/plugins/research-wiki/` directory
2. Enable the plugin in Obsidian settings
3. Configure your **API URL** and **API Key** in the plugin settings
4. Generate an API key from the wiki (logged in → `POST /api/keys`)

## Commands

### Publish to Wiki

Pushes the active note to the wiki via `POST /api/documents/ingest`.

Uses YAML frontmatter for metadata:

```yaml
---
title: "Apple Q4 2025 Analysis"
type: COMPANY_RESEARCH
companies: ["Apple Inc", "Microsoft"]
tags: ["earnings", "tech"]
---
```

- **title**: defaults to filename if not specified
- **type**: one of `COMPANY_RESEARCH`, `SECTOR_ANALYSIS`, `REGION_ANALYSIS`, `BROKER_RESEARCH`, `NEWS`, `EARNINGS_TRANSCRIPT`
- **companies**: array of company names (matched case-insensitively against the wiki database)
- **tags**: array of tag names (auto-created if they don't exist)

Upserts by title + author — publishing the same note again updates the existing document.

### Pull from Wiki

Fetches a document from the wiki by matching the current file's name against document titles. Replaces the file content with the wiki version, including generated frontmatter.

## Building

The plugin source is TypeScript. To build for distribution:

```bash
cd obsidian-plugin
npm install
npm run build
```

This produces `main.js` in the plugin directory for Obsidian to load.
