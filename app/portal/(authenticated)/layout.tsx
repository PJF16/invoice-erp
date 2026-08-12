import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalLogoutButton } from "@/components/portal-logout-button";
import { getPortalSession } from "@/lib/portal-auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AuthenticatedPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const settings = await getSettings();
  const company = settings.name || "Kundenportal";

  return (
    <div className="min-h-screen flex-1 bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/portal" className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-sm font-bold text-white shadow-sm">
              {company.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{company}</span>
              <span className="block text-xs text-slate-500">Kundenportal</span>
            </span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="hidden max-w-56 truncate text-sm text-slate-500 sm:block">{session.email}</span>
            <PortalLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-8 text-xs text-slate-500 sm:px-6 lg:px-8">
        <span>{company}</span>
        {settings.email && <a href={`mailto:${settings.email}`} className="hover:text-slate-900">Kontakt: {settings.email}</a>}
      </footer>
    </div>
  );
}
