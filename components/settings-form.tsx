"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Settings = {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  uid: string;
  iban: string;
  bic: string;
  bankName: string;
  email: string;
  phone: string;
  invoicePrefix: string;
  paymentDays: number;
  emailSubject: string;
  emailBody: string;
  lastInvoiceYear: number;
  lastInvoiceSeq: number;
};

export function SettingsForm({
  settings,
  smtpConfigured,
}: {
  settings: Settings;
  smtpConfigured: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        street: form.get("street"),
        zip: form.get("zip"),
        city: form.get("city"),
        country: form.get("country"),
        uid: form.get("uid"),
        iban: form.get("iban"),
        bic: form.get("bic"),
        bankName: form.get("bankName"),
        email: form.get("email"),
        phone: form.get("phone"),
        invoicePrefix: form.get("invoicePrefix"),
        paymentDays: Number(form.get("paymentDays")),
        emailSubject: form.get("emailSubject"),
        emailBody: form.get("emailBody"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Speichern fehlgeschlagen");
    }
  }

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  const label = "block text-sm font-medium";

  const nextNumber = `${settings.invoicePrefix}${new Date().getFullYear()}-${String(
    settings.lastInvoiceYear === new Date().getFullYear() ? settings.lastInvoiceSeq + 1 : 1,
  ).padStart(3, "0")}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Firmendaten (Rechnungskopf)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Firmenname</label>
            <input name="name" defaultValue={settings.name} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Straße</label>
            <input name="street" defaultValue={settings.street} className={input} />
          </div>
          <div>
            <label className={label}>PLZ</label>
            <input name="zip" defaultValue={settings.zip} className={input} />
          </div>
          <div>
            <label className={label}>Ort</label>
            <input name="city" defaultValue={settings.city} className={input} />
          </div>
          <div>
            <label className={label}>Land</label>
            <input name="country" defaultValue={settings.country} className={input} />
          </div>
          <div>
            <label className={label}>UID-Nummer</label>
            <input name="uid" defaultValue={settings.uid} placeholder="ATU12345678" className={`${input} font-mono`} />
          </div>
          <div>
            <label className={label}>E-Mail</label>
            <input name="email" type="email" defaultValue={settings.email} className={input} />
          </div>
          <div>
            <label className={label}>Telefon</label>
            <input name="phone" defaultValue={settings.phone} className={input} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Bankverbindung</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Bank</label>
            <input name="bankName" defaultValue={settings.bankName} className={input} />
          </div>
          <div>
            <label className={label}>IBAN</label>
            <input name="iban" defaultValue={settings.iban} className={`${input} font-mono`} />
          </div>
          <div>
            <label className={label}>BIC</label>
            <input name="bic" defaultValue={settings.bic} className={`${input} font-mono`} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold">Rechnungen</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Rechnungsnummern-Präfix</label>
            <input name="invoicePrefix" defaultValue={settings.invoicePrefix} placeholder='z.B. "RE-"' className={`${input} font-mono`} />
            <p className="mt-1 text-xs text-gray-500">
              Nächste Nummer: <span className="font-mono font-semibold">{nextNumber}</span> (fortlaufend pro Jahr)
            </p>
          </div>
          <div>
            <label className={label}>Zahlungsziel (Tage)</label>
            <input name="paymentDays" type="number" min={0} max={365} defaultValue={settings.paymentDays} className={input} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">E-Mail-Versand</h2>
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
              smtpConfigured
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {smtpConfigured ? "SMTP konfiguriert" : "SMTP nicht konfiguriert"}
          </span>
        </div>
        {!smtpConfigured && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Für den automatischen Versand SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS und SMTP_FROM in der
            <code className="mx-1 font-mono">.env</code> setzen und den Server neu starten.
          </p>
        )}
        <div className="grid gap-4">
          <div>
            <label className={label}>Betreff-Vorlage</label>
            <input name="emailSubject" defaultValue={settings.emailSubject} className={input} />
          </div>
          <div>
            <label className={label}>Text-Vorlage</label>
            <textarea name="emailBody" rows={5} defaultValue={settings.emailBody} className={input} />
            <p className="mt-1 text-xs text-gray-500">
              Platzhalter: <code className="font-mono">{"{nummer}"}</code> = Rechnungsnummer,{" "}
              <code className="font-mono">{"{kunde}"}</code> = Kundenname
            </p>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Gespeichert.</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}
