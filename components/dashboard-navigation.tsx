"use client";

import { useState } from "react";
import { NavLinks } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";
import { Modal } from "@/components/modal";
import type { ModuleName } from "@/lib/permissions";

export function DashboardNavigation({ user }: { user: { name?: string | null; email?: string | null; role: "ADMIN" | "MEMBER"; modules: ModuleName[] } }) {
  const [open, setOpen] = useState(false);
  const links = <NavLinks isAdmin={user.role === "ADMIN"} modules={user.modules} />;
  const account = <div className="mt-auto border-t border-gray-200 px-5 py-4"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-gray-500">{user.email}</p><LogoutButton /></div>;
  return <>
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden print:hidden">
      <span className="font-semibold">Lager & Rechnungen</span>
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium">Menü</button>
    </header>
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white md:flex print:hidden">
      <div className="px-5 py-5 text-lg font-semibold tracking-tight">Lager & Rechnungen</div>{links}{account}
    </aside>
    {open && <Modal title="Navigation" onClose={() => setOpen(false)}><div onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{links}</div>{account}</Modal>}
  </>;
}
