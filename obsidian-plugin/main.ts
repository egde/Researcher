import { Plugin, Notice, requestUrl, MarkdownView, TFile } from "obsidian";
import { ResearchWikiSettingTab, type ResearchWikiSettings } from "./settings";

const DEFAULT_SETTINGS: ResearchWikiSettings = {
  apiUrl: "http://localhost:3000",
  apiKey: "",
};

export default class ResearchWikiPlugin extends Plugin {
  settings!: ResearchWikiSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "publish-to-wiki",
      name: "Publish to Wiki",
      callback: () => this.publishCurrentNote(),
    });

    this.addCommand({
      id: "pull-from-wiki",
      name: "Pull from Wiki",
      callback: () => this.pullCurrentNote(),
    });

    this.addSettingTab(new ResearchWikiSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private getBaseUrl(): string {
    return this.settings.apiUrl.replace(/\/+$/, "");
  }

  /**
   * Parse YAML frontmatter from markdown content.
   * Returns { frontmatter, body } where frontmatter is a key-value map.
   */
  private parseFrontmatter(content: string): {
    frontmatter: Record<string, string | string[]>;
    body: string;
  } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };

    const raw = match[1];
    const body = match[2];
    const frontmatter: Record<string, string | string[]> = {};

    for (const line of raw.split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();

      // Handle YAML arrays: "- item" lines or "[item1, item2]"
      if (value.startsWith("[") && value.endsWith("]")) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
      } else if (value === "") {
        // Multi-line array follows
        const arr: string[] = [];
        const lines = raw.split("\n");
        const startIdx = lines.indexOf(line);
        for (let i = startIdx + 1; i < lines.length; i++) {
          const item = lines[i].trim();
          if (item.startsWith("- ")) {
            arr.push(item.slice(2).trim().replace(/^["']|["']$/g, ""));
          } else {
            break;
          }
        }
        if (arr.length > 0) frontmatter[key] = arr;
      } else {
        frontmatter[key] = value.replace(/^["']|["']$/g, "");
      }
    }

    return { frontmatter, body };
  }

  /**
   * Publish the active note to the Research Wiki.
   *
   * Reads YAML frontmatter for metadata:
   *   - title (defaults to filename)
   *   - type (defaults to COMPANY_RESEARCH)
   *   - companies (array of company names)
   *   - tags (array of tag names)
   */
  async publishCurrentNote() {
    if (!this.settings.apiKey) {
      new Notice("Research Wiki: Set your API key in settings first");
      return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) {
      new Notice("Research Wiki: No active markdown file");
      return;
    }

    const content = await this.app.vault.read(view.file);
    const { frontmatter, body } = this.parseFrontmatter(content);

    const title = (frontmatter.title as string) || view.file.basename;
    const type = (frontmatter.type as string) || "COMPANY_RESEARCH";
    const companies = Array.isArray(frontmatter.companies)
      ? frontmatter.companies
      : [];
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];

    try {
      new Notice("Research Wiki: Publishing...");

      const response = await requestUrl({
        url: `${this.getBaseUrl()}/api/documents/ingest`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.apiKey}`,
        },
        body: JSON.stringify({
          title,
          content: body || content,
          type: type.toUpperCase().replace(/\s+/g, "_"),
          companies,
          tags,
        }),
      });

      if (response.status >= 200 && response.status < 300) {
        const data = response.json;
        new Notice(`Research Wiki: Published → ${data.slug}`);
      } else {
        const data = response.json;
        new Notice(
          `Research Wiki: Failed (${response.status}) — ${data.error || "Unknown error"}`
        );
      }
    } catch (err) {
      new Notice(
        `Research Wiki: Network error — ${err instanceof Error ? err.message : "Check your API URL"}`
      );
    }
  }

  /**
   * Pull a document from the wiki into the current vault.
   *
   * Searches by the current file's basename. If found, replaces the file
   * content with the wiki version (preserving local frontmatter).
   */
  async pullCurrentNote() {
    if (!this.settings.apiKey) {
      new Notice("Research Wiki: Set your API key in settings first");
      return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) {
      new Notice("Research Wiki: No active markdown file");
      return;
    }

    const title = view.file.basename;

    try {
      new Notice("Research Wiki: Pulling...");

      // Search for the document by title
      const searchRes = await requestUrl({
        url: `${this.getBaseUrl()}/api/search?q=${encodeURIComponent(title)}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
        },
      });

      const searchData = searchRes.json;
      const docs = searchData.documents || [];

      // Find exact title match
      const match = docs.find(
        (d: { title: string }) =>
          d.title.toLowerCase() === title.toLowerCase()
      );

      if (!match) {
        new Notice("Research Wiki: Document not found on wiki");
        return;
      }

      // Fetch full document
      const docRes = await requestUrl({
        url: `${this.getBaseUrl()}/api/documents/${match.slug}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
        },
      });

      const doc = docRes.json;

      // Build frontmatter
      const companies = (doc.companies || [])
        .map((dc: { company: { name: string } }) => dc.company.name);
      const tags = (doc.tags || [])
        .map((dt: { tag: { name: string } }) => dt.tag.name);

      const fm = [
        "---",
        `title: "${doc.title}"`,
        `type: ${doc.type}`,
      ];
      if (companies.length > 0) {
        fm.push(`companies: [${companies.map((c: string) => `"${c}"`).join(", ")}]`);
      }
      if (tags.length > 0) {
        fm.push(`tags: [${tags.map((t: string) => `"${t}"`).join(", ")}]`);
      }
      fm.push("---", "");

      const newContent = fm.join("\n") + doc.content;

      await this.app.vault.modify(view.file as TFile, newContent);
      new Notice(`Research Wiki: Pulled "${doc.title}"`);
    } catch (err) {
      new Notice(
        `Research Wiki: Error — ${err instanceof Error ? err.message : "Check your connection"}`
      );
    }
  }
}
