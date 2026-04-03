"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";

const links = [
  { href: "/", label: "HOME" },
  { href: "/documents", label: "DOCUMENTS" },
  { href: "/companies", label: "COMPANIES" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border-strong bg-background">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-12 gap-6">
        <Link href="/" className="text-sm font-bold tracking-wider no-underline text-foreground">
          RESEARCH
        </Link>

        <div className="flex items-center gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[11px] tracking-wider no-underline transition-opacity ${
                pathname === link.href
                  ? "text-foreground border-b border-foreground pb-0.5"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto w-72">
          <SearchBar />
        </div>
      </div>
    </nav>
  );
}
