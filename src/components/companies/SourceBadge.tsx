import { Badge } from "@/components/ui/Badge";

export function SourceBadge({ source }: { source: string }) {
  const isExternal = source === "databricks";

  return (
    <Badge variant={isExternal ? "outline" : "solid"}>
      {isExternal ? "external" : source === "obsidian" ? "research" : "internal"}
    </Badge>
  );
}
