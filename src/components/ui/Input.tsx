import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label className="block text-[10px] uppercase tracking-wider text-muted mb-1">
          {label}
        </label>
      )}
      <input
        className={`w-full border border-foreground bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground ${className}`}
        {...props}
      />
    </div>
  );
}
