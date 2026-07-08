import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NavLinks } from "@/components/nav-links";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="px-5 py-5">
          <span className="text-lg font-semibold tracking-tight">📦 Lager</span>
        </div>
        <NavLinks isAdmin={session.user.role === "ADMIN"} />
        <div className="mt-auto border-t border-gray-200 px-5 py-4">
          <p className="truncate text-sm font-medium">{session.user.name}</p>
          <p className="truncate text-xs text-gray-500">{session.user.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-6 lg:p-8">{children}</main>
    </div>
  );
}
