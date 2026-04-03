export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-border bg-background p-4 ${className}`}>
      {children}
    </div>
  );
}
