/**
 * Parse wiki-style links from markdown content.
 * Supports [[Document Title]] and [[slug]] formats.
 * Returns an array of referenced slugs/titles.
 */
export function parseWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}
