"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SmtpSettingsData = {
  host: string;
  port: number;
  security: "STARTTLS" | "TLS" | "NONE";
  user: string;
  from: string;
  passwordConfigured: boolean;
  configured: boolean;
  source: "DATABASE" | "ENV" | "JSON" | "NONE";
};

export function SmtpSettingsForm({ settings }: { settings: SmtpSettingsData }) {
  const router = useRouter();
  const [host, setHost] = useState(settings.host);
  const [port, setPort] = useState(settings.port);
  const [security, setSecurity] = useState(settings.security);
  const [user, setUser] = useState(settings.user);
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState(settings.from);
  const [passwordConfigured, setPasswordConfigured] = useState(settings.passwordConfigured);
  const [configured, setConfigured] = useState(settings.configured);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  async function save() {
    setError(null);
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/smtp-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, port, security, user, password, from }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? "SMTP-Einstellungen konnten nicht gespeichert werden");
      return false;
    }
    setPassword("");
    setPasswordConfigured(data.passwordConfigured);
    setConfigured(data.configured);
    setMessage("SMTP-Einstellungen gespeichert.");
    router.refresh();
    return true;
  }

  async function testConnection() {
    if (!(await save())) return;
    setMessage(null);
    setTesting(true);
    const response = await fetch("/api/smtp-settings/test", { method: "POST" });
    const data = await response.json().catch(() => null);
    setTesting(false);
    if (!response.ok) setError(data?.error ?? "SMTP-Test fehlgeschlagen");
    else setMessage(data.message);
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">SMTP-Einstellungen</h2>
            <p className="mt-1 text-xs text-gray-500">Das Passwort wird verschlüsselt gespeichert und nie wieder angezeigt.</p>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${configured ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {configured ? "SMTP konfiguriert" : "SMTP nicht konfiguriert"}
          </span>
        </div>

        {settings.source === "ENV" && !host && (
          <p className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            Derzeit wird die SMTP-Konfiguration aus den Umgebungsvariablen verwendet. Gespeicherte Backend-Einstellungen haben Vorrang.
          </p>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>SMTP-Server</label>
            <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="smtp.example.com" className={input} />
          </div>
          <div>
            <label className={label}>Port</label>
            <input type="number" min={1} max={65535} value={port} onChange={(event) => setPort(Number(event.target.value))} className={input} />
          </div>
          <div>
            <label className={label}>Verschlüsselung</label>
            <select value={security} onChange={(event) => setSecurity(event.target.value as typeof security)} className={input}>
              <option value="STARTTLS">STARTTLS (meist Port 587)</option>
              <option value="TLS">SSL/TLS (meist Port 465)</option>
              <option value="NONE">Keine Verschlüsselung</option>
            </select>
          </div>
          <div>
            <label className={label}>Benutzername</label>
            <input value={user} onChange={(event) => setUser(event.target.value)} autoComplete="username" className={input} />
          </div>
          <div>
            <label className={label}>Passwort</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder={passwordConfigured ? "Gespeichertes Passwort beibehalten" : "SMTP-Passwort"} className={input} />
          </div>
          <div>
            <label className={label}>Absender</label>
            <input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Firma GmbH <rechnung@firma.at>" className={input} />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="submit" disabled={saving || testing} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            {saving && !testing ? "Speichere…" : "SMTP speichern"}
          </button>
          <button type="button" onClick={() => void testConnection()} disabled={saving || testing} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {testing ? "Teste Verbindung…" : "Speichern & Verbindung testen"}
          </button>
        </div>
      </section>
    </form>
  );
}
