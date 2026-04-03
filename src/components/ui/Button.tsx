import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center px-4 py-2 text-xs uppercase tracking-wider font-medium transition-opacity disabled:opacity-50";

  const variants: Record<Variant, string> = {
    primary: "bg-foreground text-background hover:opacity-80",
    secondary: "border border-foreground text-foreground hover:bg-foreground hover:text-background",
    ghost: "text-foreground hover:opacity-60",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
