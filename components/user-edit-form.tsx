"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES, MODULE_LABELS, type ModuleName } from "@/lib/permissions";

type EditableUser = {
  id: string;
  name: string;
  role: "ADMIN" | "MEMBER";
  modules: ModuleName[];
};

export function UserEditForm({ user }: { user: EditableUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const password = form.get("password");
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        role: form.get("role"),
        modules: form.getAll("modules"),
        ...(password ? { password } : {}),
      }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Speichern fehlgeschlagen");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
      >
        Bearbeiten
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Benutzer bearbeiten</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Name *</label>
                <input
                  name="name"
                  required
                  autoFocus
                  defaultValue={user.name}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Neues Passwort</label>
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  placeholder="Unverändert lassen"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Rolle</label>
                <select
                  name="role"
                  defaultValue={user.role}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="MEMBER">Mitarbeiter</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Zugriff</label>
                <p className="mt-1 text-xs text-gray-500">Admins haben immer Zugriff auf alle Bereiche.</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {MODULES.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="modules"
                        value={m}
                        defaultChecked={user.modules.includes(m)}
                      />
                      {MODULE_LABELS[m]}
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Speichere…" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
