import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/user-form";
import { UserEditForm } from "@/components/user-edit-form";
import { MODULE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, modules: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Benutzer</h1>
          <p className="text-sm text-gray-500">{users.length} Konten</p>
        </div>
        <UserForm />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">E-Mail</th>
              <th className="px-4 py-3">Rolle</th>
              <th className="px-4 py-3">Zugriff</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                      u.role === "ADMIN"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {u.role === "ADMIN" ? "Admin" : "Mitarbeiter"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {u.role === "ADMIN"
                    ? "Alle Bereiche"
                    : u.modules.length > 0
                      ? u.modules.map((m) => MODULE_LABELS[m]).join(", ")
                      : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <UserEditForm user={u} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
