"use client";

import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-border-strong bg-background">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-12 gap-4 sm:gap-6">
        <Link href="/" className="text-sm font-bold tracking-wider no-underline text-foreground shrink-0">
          RESEARCH
        </Link>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-4">
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

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <div className="w-40 sm:w-72">
            <SearchBar />
          </div>
          {/* Desktop auth */}
          <div className="hidden sm:flex items-center gap-3">
            {session ? (
              <>
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
              </>
            ) : (
              <Link
                href="/login"
                className="text-[10px] uppercase tracking-wider no-underline text-muted hover:text-foreground"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden text-foreground text-lg cursor-pointer"
            aria-label="Menu"
          >
            {menuOpen ? "\u2715" : "\u2630"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border px-4 py-3 space-y-3 bg-background">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`text-[11px] tracking-wider no-underline ${
                  pathname === link.href
                    ? "text-foreground"
                    : "text-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border pt-2 flex flex-col gap-2">
            {session ? (
              <>
                <Link
                  href="/documents/new"
                  onClick={() => setMenuOpen(false)}
                  className="text-[10px] uppercase tracking-wider no-underline text-foreground"
                >
                  + New Document
                </Link>
                <span className="text-[10px] text-muted">{session.user.name}</span>
                <button
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="text-[10px] uppercase tracking-wider text-muted hover:text-foreground cursor-pointer text-left"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="text-[10px] uppercase tracking-wider no-underline text-muted"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
