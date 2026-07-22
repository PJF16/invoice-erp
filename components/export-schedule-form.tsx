"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toDateInput } from "@/lib/format";

type ScheduleData = {
  id?: string;
  name: string;
  active: boolean;
  interval: string;
  nextRun: string;
  period: string;
  types: string[];
  recipientEmail: string;
  emailSubject: string;
  emailBody: string;
};

const DEFAULT_BODY =
  "Sehr geehrte Damen und Herren,\n\nanbei der Belegexport für {zeitraum}.\n\nMit freundlichen Grüßen";

function ScheduleDialog({ schedule, onClose }: { schedule: ScheduleData | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(schedule?.name ?? "");
  const [active, setActive] = useState(schedule?.active ?? true);
  const [interval, setInterval] = useState(schedule?.interval ?? "MONTHLY");
  const [nextRun, setNextRun] = useState(schedule?.nextRun ? toDateInput(schedule.nextRun) : toDateInput(new Date()));
  const [period, setPeriod] = useState(schedule?.period ?? "PREVIOUS_MONTH");
  const [includeInvoices, setIncludeInvoices] = useState(schedule?.types.includes("INVOICE") ?? true);
  const [includeCreditNotes, setIncludeCreditNotes] = useState(schedule?.types.includes("CREDIT_NOTE") ?? false);
  const [recipientEmail, setRecipientEmail] = useState(schedule?.recipientEmail ?? "");
  const [emailSubject, setEmailSubject] = useState(schedule?.emailSubject ?? "Belegexport {zeitraum}");
  const [emailBody, setEmailBody] = useState(schedule?.emailBody ?? DEFAULT_BODY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(schedule?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const types = [includeInvoices && "INVOICE", includeCreditNotes && "CREDIT_NOTE"].filter(Boolean);
    if (types.length === 0) {
      setError("Mindestens ein Dokumenttyp ist erforderlich");
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch(isEdit ? `/api/export-schedules/${schedule!.id}` : "/api/export-schedules", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        active,
        interval,
        nextRun,
        period,
        types,
        recipientEmail,
        emailSubject,
        emailBody,
      }),
    });
    setLoading(false);
    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Speichern fehlgeschlagen");
    }
  }

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{isEdit ? "Geplanten Export bearbeiten" : "Neuer geplanter Export"}</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className={label}>Name *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Monatsexport Steuerberater"
              autoFocus
              className={input}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Zeitraum</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className={input}>
                <option value="PREVIOUS_MONTH">Vormonat</option>
                <option value="PREVIOUS_QUARTER">Vorquartal</option>
                <option value="PREVIOUS_YEAR">Vorjahr</option>
                <option value="ALL_TIME">Alle Belege</option>
              </select>
            </div>
            <div>
              <label className={label}>Intervall</label>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} className={input}>
                <option value="MONTHLY">Monatlich</option>
                <option value="QUARTERLY">Quartalsweise</option>
                <option value="YEARLY">Jährlich</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Nächster Versand *</label>
            <input
              type="date"
              required
              value={nextRun}
              onChange={(e) => setNextRun(e.target.value)}
              className={input}
            />
          </div>

          <div>
            <label className={label}>Dokumenttyp</label>
            <div className="mt-1 flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeInvoices} onChange={(e) => setIncludeInvoices(e.target.checked)} />
                Rechnungen
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeCreditNotes}
                  onChange={(e) => setIncludeCreditNotes(e.target.checked)}
                />
                Gutschriften
              </label>
            </div>
          </div>

          <div>
            <label className={label}>Empfänger-E-Mail(s) *</label>
            <input
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="steuerberater@kanzlei.at, buchhaltung@firma.at"
              className={input}
            />
            <p className="mt-1 text-xs text-gray-500">Mehrere Adressen mit Komma trennen.</p>
          </div>

          <div>
            <label className={label}>Betreff-Vorlage</label>
            <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Text-Vorlage</label>
            <textarea rows={4} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} className={input} />
            <p className="mt-1 text-xs text-gray-500">
              Platzhalter: <code className="font-mono">{"{zeitraum}"}</code> (z.B. „Juni 2026“)
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Aktiv
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
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
  );
}

export function ExportScheduleForm() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + Neuer geplanter Export
      </button>
      {open && <ScheduleDialog schedule={null} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ExportScheduleRowActions({
  schedule,
}: {
  schedule: ScheduleData & { id: string };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  async function runNow() {
    if (!confirm(`„${schedule.name}" jetzt ausführen und per E-Mail versenden?`)) return;
    setLoading(true);
    const res = await fetch(`/api/export-schedules/${schedule.id}/run`, { method: "POST" });
    setLoading(false);
    const data = await res.json().catch(() => null);
    if (res.ok) {
      alert(
        data.sent
          ? `${data.count} Beleg(e) für „${data.label}" versendet an ${data.recipient}.`
          : (data.reason ?? "Keine Belege gefunden."),
      );
      router.refresh();
    } else {
      alert(data?.error ?? "Ausführung fehlgeschlagen");
    }
  }

  async function handleDelete() {
    if (!confirm(`Geplanten Export „${schedule.name}" löschen?`)) return;
    const res = await fetch(`/api/export-schedules/${schedule.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Löschen fehlgeschlagen");
  }

  return (
    <div className="inline-flex gap-1">
      <button
        onClick={runNow}
        disabled={loading}
        className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {loading ? "Läuft…" : "Jetzt ausführen"}
      </button>
      <button onClick={() => setEditing(true)} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100">
        Bearbeiten
      </button>
      <button onClick={handleDelete} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">
        Löschen
      </button>
      {editing && <ScheduleDialog schedule={schedule} onClose={() => setEditing(false)} />}
    </div>
  );
}
