"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BackupSettingsData = {
  enabled: boolean;
  target: "LOCAL" | "SMB";
  interval: "DAILY" | "WEEKLY" | "MONTHLY";
  nextRun: string | null;
  localPath: string;
  smbHost: string;
  smbPort: number;
  smbShare: string;
  smbPath: string;
  smbDomain: string;
  smbUsername: string;
  smbPasswordConfigured: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  running: boolean;
};

function toDateTimeLocal(value: string | Date) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "–";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupSettingsForm({ settings }: { settings: BackupSettingsData }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [target, setTarget] = useState(settings.target);
  const [interval, setInterval] = useState(settings.interval);
  const [nextRun, setNextRun] = useState(
    settings.nextRun ? toDateTimeLocal(settings.nextRun) : "",
  );
  const [localPath, setLocalPath] = useState(settings.localPath);
  const [smbHost, setSmbHost] = useState(settings.smbHost);
  const [smbPort, setSmbPort] = useState(settings.smbPort);
  const [smbShare, setSmbShare] = useState(settings.smbShare);
  const [smbPath, setSmbPath] = useState(settings.smbPath);
  const [smbDomain, setSmbDomain] = useState(settings.smbDomain);
  const [smbUsername, setSmbUsername] = useState(settings.smbUsername);
  const [smbPassword, setSmbPassword] = useState("");
  const [passwordConfigured, setPasswordConfigured] = useState(settings.smbPasswordConfigured);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(settings.running);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  async function save() {
    setError(null);
    setMessage(null);
    setSaving(true);
    const response = await fetch("/api/backup-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        target,
        interval,
        nextRun: nextRun ? new Date(nextRun).toISOString() : null,
        localPath,
        smbHost,
        smbPort,
        smbShare,
        smbPath,
        smbDomain,
        smbUsername,
        smbPassword,
      }),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? "Backup-Einstellungen konnten nicht gespeichert werden");
      return false;
    }
    setPasswordConfigured(data.smbPasswordConfigured);
    setSmbPassword("");
    setMessage("Backup-Einstellungen gespeichert.");
    router.refresh();
    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await save();
  }

  async function runNow() {
    if (!(await save())) return;
    setMessage(null);
    setRunning(true);
    const response = await fetch("/api/backups/run", { method: "POST" });
    const data = await response.json().catch(() => null);
    setRunning(false);
    if (!response.ok) {
      setError(data?.error ?? "Backup fehlgeschlagen");
    } else {
      setMessage(`Backup ${data.filename} erfolgreich erstellt (${formatBytes(data.size)}).`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Automatische Backups</h2>
            <p className="mt-1 text-xs text-gray-500">
              Sichert die komplette PostgreSQL-Datenbank als komprimierten Dump.
            </p>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              settings.lastError
                ? "border-red-200 bg-red-50 text-red-700"
                : settings.lastSuccessAt
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-600"
            }`}
          >
            {running ? "Backup läuft…" : settings.lastError ? "Letztes Backup fehlgeschlagen" : settings.lastSuccessAt ? "Bereit" : "Noch kein Backup"}
          </span>
        </div>

        <label className="mt-5 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Backups automatisch ausführen
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Ziel</label>
            <select value={target} onChange={(event) => setTarget(event.target.value as "LOCAL" | "SMB")} className={input}>
              <option value="SMB">SMB-Netzwerkfreigabe</option>
              <option value="LOCAL">Lokaler Ordner</option>
            </select>
          </div>
          <div>
            <label className={label}>Intervall</label>
            <select
              value={interval}
              onChange={(event) => setInterval(event.target.value as typeof interval)}
              className={input}
            >
              <option value="DAILY">Täglich</option>
              <option value="WEEKLY">Wöchentlich</option>
              <option value="MONTHLY">Monatlich</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Nächste Ausführung</label>
            <input
              type="datetime-local"
              required={enabled}
              value={nextRun}
              onChange={(event) => setNextRun(event.target.value)}
              className={input}
            />
            <p className="mt-1 text-xs text-gray-500">
              Der Scheduler prüft stündlich; danach wird der Termin entsprechend dem Intervall weitergesetzt.
            </p>
          </div>
        </div>

        {target === "LOCAL" ? (
          <div className="mt-4">
            <label className={label}>Absoluter Serverpfad</label>
            <input
              required
              value={localPath}
              onChange={(event) => setLocalPath(event.target.value)}
              placeholder="/backups"
              className={`${input} font-mono`}
            />
            <p className="mt-1 text-xs text-gray-500">
              Im Docker-Betrieb sollte dieser Pfad als persistentes Volume eingebunden sein.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Server / Host *</label>
              <input required={enabled} value={smbHost} onChange={(event) => setSmbHost(event.target.value)} placeholder="nas.local" className={input} />
            </div>
            <div>
              <label className={label}>Port</label>
              <input
                type="number"
                min={1}
                max={65535}
                value={smbPort}
                onChange={(event) => setSmbPort(Number(event.target.value))}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Freigabe *</label>
              <input required={enabled} value={smbShare} onChange={(event) => setSmbShare(event.target.value)} placeholder="Backups" className={input} />
            </div>
            <div>
              <label className={label}>Unterordner</label>
              <input value={smbPath} onChange={(event) => setSmbPath(event.target.value)} placeholder="invoice-erp" className={input} />
            </div>
            <div>
              <label className={label}>Domäne</label>
              <input value={smbDomain} onChange={(event) => setSmbDomain(event.target.value)} placeholder="WORKGROUP (optional)" className={input} />
            </div>
            <div>
              <label className={label}>Benutzername *</label>
              <input required={enabled} value={smbUsername} onChange={(event) => setSmbUsername(event.target.value)} autoComplete="username" className={input} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Passwort {passwordConfigured && <span className="font-normal text-green-700">(gespeichert)</span>}</label>
              <input
                type="password"
                required={enabled && !passwordConfigured}
                value={smbPassword}
                onChange={(event) => setSmbPassword(event.target.value)}
                autoComplete="new-password"
                placeholder={passwordConfigured ? "Leer lassen, um das gespeicherte Passwort beizubehalten" : ""}
                className={input}
              />
              <p className="mt-1 text-xs text-gray-500">
                Das Passwort wird verschlüsselt gespeichert und nie wieder über die API ausgegeben.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <div className="grid gap-1 sm:grid-cols-2">
            <span>Letzter Versuch: {formatDateTime(settings.lastRunAt)}</span>
            <span>Letzter Erfolg: {formatDateTime(settings.lastSuccessAt)}</span>
          </div>
          {settings.lastError && <p className="mt-2 text-red-700">{settings.lastError}</p>}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={saving || running}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {running ? "Backup läuft…" : "Jetzt sichern"}
          </button>
          <button
            type="submit"
            disabled={saving || running}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Speichere…" : "Backup-Einstellungen speichern"}
          </button>
        </div>
      </section>
    </form>
  );
}
