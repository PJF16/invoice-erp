import Link from "next/link";
import type { ListParams } from "@/lib/list-query";

export function ListPagination({ page, pages, total, params }: { page: number; pages: number; total: number; params: ListParams }) {
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string" && value && key !== "page") query.set(key, value);
    query.set("page", String(target));
    return `?${query}`;
  };
  return <nav aria-label="Seitennavigation" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p className="text-gray-500">{total} Treffer · Seite {page} von {pages}</p>
    <div className="flex gap-2">{page > 1 && <Link rel="prev" href={href(page - 1)} className="rounded-lg border border-gray-300 bg-white px-4 py-2">← Zurück</Link>}{page < pages && <Link rel="next" href={href(page + 1)} className="rounded-lg border border-gray-300 bg-white px-4 py-2">Weiter →</Link>}</div>
  </nav>;
}
