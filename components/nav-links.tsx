"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ModuleName } from "@/lib/permissions";

const groups: {
  title: string;
  module?: ModuleName;
  links: { href: string; label: string }[];
}[] = [
  {
    title: "Übersicht",
    links: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Lager",
    module: "STOCK",
    links: [
      { href: "/stock", label: "Bestand" },
      { href: "/items", label: "Artikel" },
      { href: "/warehouses", label: "Lager" },
      { href: "/movements", label: "Historie" },
    ],
  },
  {
    title: "Rechnungen",
    module: "INVOICES",
    links: [
      { href: "/invoices", label: "Rechnungen" },
      { href: "/offene-posten", label: "Offene Posten" },
      { href: "/reminders", label: "Mahnwesen" },
      { href: "/recurring", label: "Wiederkehrend" },
      { href: "/customers", label: "Kunden" },
      { href: "/software", label: "Software" },
      { href: "/export", label: "Export" },
    ],
  },
];

export function NavLinks({ isAdmin, modules }: { isAdmin: boolean; modules: ModuleName[] }) {
  const pathname = usePathname();

  const visibleGroups = groups.filter((g) => !g.module || isAdmin || modules.includes(g.module));

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
      {[...visibleGroups, ...adminGroup].map((group) => (
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
