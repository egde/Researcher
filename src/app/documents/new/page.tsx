import { DocumentForm } from "@/components/editor/DocumentForm";

export default function NewDocumentPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-base font-bold uppercase tracking-wider mb-6">
        New Document
      </h1>
      <DocumentForm mode="create" />
    </div>
  );
}
