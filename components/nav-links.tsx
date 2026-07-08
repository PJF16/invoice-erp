"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const groups: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Lager",
    links: [
      { href: "/", label: "Bestand" },
      { href: "/items", label: "Artikel" },
      { href: "/warehouses", label: "Lager" },
      { href: "/movements", label: "Historie" },
    ],
  },
  {
    title: "Rechnungen",
    links: [
      { href: "/invoices", label: "Rechnungen" },
      { href: "/recurring", label: "Wiederkehrend" },
      { href: "/customers", label: "Kunden" },
      { href: "/software", label: "Software" },
    ],
  },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const adminGroup = isAdmin
    ? [
        {
          title: "Verwaltung",
          links: [
            { href: "/settings", label: "Einstellungen" },
            { href: "/users", label: "Benutzer" },
          ],
        },
      ]
    : [];

  return (
    <nav className="flex flex-col gap-4 px-3">
      {[...groups, ...adminGroup].map((group) => (
        <div key={group.title}>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.links.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
