type Variant = "outline" | "solid" | "muted";

export function Badge({
  children,
  variant = "outline",
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const base = "inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium";

  const variants: Record<Variant, string> = {
    outline: "border border-foreground text-foreground",
    solid: "bg-foreground text-background",
    muted: "border border-border text-muted",
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
