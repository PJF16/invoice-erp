"use client";

import { useState } from "react";

type ApiKeyInfo = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
};

const date = (value: string | null) => value ? new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "–";

export function ApiKeyManager({ initialKeys }: { initialKeys: ApiKeyInfo[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setError(null);
    setToken(null);
    const form = new FormData(formElement);
    const response = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), expiresAt: form.get("expiresAt") || null }),
    });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) return setError(data?.error ?? "API-Schlüssel konnte nicht erstellt werden");
    setToken(data.token);
    setKeys((current) => [{ ...data, token: undefined }, ...current]);
    formElement.reset();
  }

  async function revokeKey(id: string) {
    if (!window.confirm("Diesen API-Schlüssel wirklich widerrufen?")) return;
    const response = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (response.ok) setKeys((current) => current.filter((key) => key.id !== id));
    else setError((await response.json().catch(() => null))?.error ?? "Widerrufen fehlgeschlagen");
  }

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">API-Schlüssel</h2>
          <p className="text-xs text-gray-500">Für Integrationen und Automatisierungen. Die Schlüssel gelten mit deinen Benutzerrechten.</p>
        </div>
        <a href="/api-docs" className="text-sm font-medium text-blue-700 hover:underline">API-Dokumentation</a>
      </div>

      {token && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <strong>Jetzt kopieren – dieser Schlüssel wird nur einmal angezeigt:</strong>
          <code className="mt-2 block break-all rounded bg-white p-2 select-all">{token}</code>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={createKey} className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium">Name
          <input required name="name" maxLength={100} placeholder="z. B. Buchhaltung" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-medium">Ablaufdatum (optional)
          <input name="expiresAt" type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
        </label>
        <button disabled={loading} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Erstelle …" : "Erstellen"}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b text-xs uppercase text-gray-500"><th className="py-2">Name</th><th>Präfix</th><th>Erstellt</th><th>Zuletzt verwendet</th><th>Ablauf</th><th /></tr></thead>
          <tbody>
            {keys.map((key) => <tr key={key.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{key.name}</td><td><code>{key.prefix}…</code></td><td>{date(key.createdAt)}</td><td>{date(key.lastUsedAt)}</td><td>{date(key.expiresAt)}</td>
              <td className="text-right"><button onClick={() => revokeKey(key.id)} className="text-red-600 hover:underline">Widerrufen</button></td>
            </tr>)}
            {keys.length === 0 && <tr><td colSpan={6} className="py-5 text-center text-gray-500">Noch keine API-Schlüssel.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
