import type { ReactNode } from "react";
import type { ListParams } from "@/lib/list-query";
import { readListQuery } from "@/lib/list-query";

export function DocumentFilters({ params, children, amounts = false }: { params: ListParams; children?: ReactNode; amounts?: boolean }) {
  const query = readListQuery(params);
  const input = "mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm";
  return <form method="GET" className="mb-4 grid items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-6">
    <label className="text-sm font-medium sm:col-span-2">Suche<input type="search" name="q" defaultValue={query.q} placeholder="Nummer oder Kunde…" className={input} /></label>
    {children}
    <label className="text-sm font-medium">Datum von<input type="date" name="from" defaultValue={query.from} className={input} /></label>
    <label className="text-sm font-medium">Datum bis<input type="date" name="to" defaultValue={query.to} min={query.from || undefined} className={input} /></label>
    <label className="text-sm font-medium">Sortierung<select name="sort" defaultValue={query.sort} className={input}><option value="date_desc">Neueste zuerst</option><option value="date_asc">Älteste zuerst</option><option value="number">Nummer</option>{amounts && <option value="amount_desc">Höchster Betrag</option>}</select></label>
    <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white">Filtern</button>
    <a href="?" className="py-2 text-sm text-gray-600 underline">Filter zurücksetzen</a>
  </form>;
}
