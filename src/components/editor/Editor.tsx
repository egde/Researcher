"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Markdown } from "@tiptap/markdown";

interface EditorProps {
  content: string;
  onChange: (markdown: string) => void;
}

export function Editor({ content, onChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const md = (
        editor.storage.markdown.manager as { serialize: (doc: unknown) => string }
      ).serialize(editor.state.doc);
      onChange(md);
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-border">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[400px] focus:outline-none [&_.tiptap]:outline-none [&_.tiptap]:min-h-[400px]"
      />
    </div>
  );
}

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 text-[11px] font-mono cursor-pointer ${
      active ? "bg-foreground text-background" : "text-muted hover:text-foreground"
    }`;

  return (
    <div className="flex items-center gap-0.5 border-b border-border px-2 py-1 flex-wrap">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
      >
        I
      </button>
      <span className="w-px h-4 bg-border mx-1" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>
      <span className="w-px h-4 bg-border mx-1" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
      >
        1.
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
      >
        &ldquo;
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive("codeBlock"))}
      >
        Code
      </button>
      <span className="w-px h-4 bg-border mx-1" />
      <button
        type="button"
        onClick={() => {
          const url = window.prompt("URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        className={btn(editor.isActive("link"))}
      >
        Link
      </button>
      <button
        type="button"
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        className={btn(false)}
      >
        Table
      </button>
    </div>
  );
}
