interface DocumentViewerProps {
  html: string;
}

export function DocumentViewer({ html }: DocumentViewerProps) {
  return (
    <div
      className="prose prose-sm max-w-none
        [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-3
        [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2
        [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-1.5
        [&_p]:text-sm [&_p]:leading-relaxed [&_p]:my-2
        [&_ul]:text-sm [&_ol]:text-sm [&_li]:my-0.5
        [&_strong]:font-semibold
        [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
        [&_pre]:bg-surface [&_pre]:border [&_pre]:border-border [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto
        [&_blockquote]:border-l-2 [&_blockquote]:border-foreground [&_blockquote]:pl-4 [&_blockquote]:text-muted [&_blockquote]:italic
        [&_a]:text-link [&_a]:underline
        [&_hr]:border-border [&_hr]:my-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
