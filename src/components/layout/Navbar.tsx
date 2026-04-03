"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { SearchBar } from "@/components/search/SearchBar";

const links = [
  { href: "/", label: "HOME" },
  { href: "/documents", label: "DOCUMENTS" },
  { href: "/companies", label: "COMPANIES" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

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

        <div className="ml-auto flex items-center gap-4">
          <div className="w-72">
            <SearchBar />
          </div>
          {session ? (
            <div className="flex items-center gap-3">
              <Link
                href="/documents/new"
                className="text-[10px] uppercase tracking-wider no-underline px-2 py-1 bg-foreground text-background"
              >
                + New
              </Link>
              <span className="text-[10px] text-muted">{session.user.name}</span>
              <button
                onClick={() => signOut()}
                className="text-[10px] uppercase tracking-wider text-muted hover:text-foreground cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-[10px] uppercase tracking-wider no-underline text-muted hover:text-foreground"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
