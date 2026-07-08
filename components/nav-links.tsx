"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Bestand" },
  { href: "/items", label: "Artikel" },
  { href: "/warehouses", label: "Lager" },
  { href: "/movements", label: "Historie" },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const allLinks = isAdmin ? [...links, { href: "/users", label: "Benutzer" }] : links;

  return (
    <nav className="flex flex-col gap-1 px-3">
      {allLinks.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
