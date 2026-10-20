"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const links = [
  { href: "/", label: "Cashflow" },
  { href: "/networth", label: "Net worth" },
  { href: "/saa", label: "SAA" },
  { href: "/montecarlo", label: "Monte Carlo" },
  { href: "/docs", label: "Docs" },
];

/** `profile` is a server component (session), passed in because this one is a client component. */
export function Navbar({ profile }: { profile: ReactNode }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-100 bg-zinc-100" aria-label="Main navigation">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1 overflow-x-auto px-4 py-2 text-sm sm:px-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? "page" : undefined}
            className={`shrink-0 px-2 py-1 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
              pathname === link.href ? "font-semibold text-black" : "text-zinc-600"
            }`}
          >
            {link.label}
          </Link>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">{profile}</div>
      </div>
    </nav>
  );
}
