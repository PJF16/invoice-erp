import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardNavigation } from "@/components/dashboard-navigation";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col md:flex-row">
      <DashboardNavigation user={session.user} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 print:p-0">{children}</main>
    </div>
  );
}
