"use client";

import { FormEvent, useState } from "react";

type Step = "email" | "code";

export function PortalLoginForm({ initialError }: { initialError?: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(initialError ?? "");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Der Code konnte nicht versendet werden.");
      setStep("code");
      setMessage(body.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Der Code konnte nicht versendet werden.");
    } finally {
      setBusy(false);
    }
  }

  function requestCode(event: FormEvent) {
    event.preventDefault();
    void sendCode();
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Der Code konnte nicht geprüft werden.");
      window.location.assign("/portal");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Der Code konnte nicht geprüft werden.");
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="space-y-5">
        <div>
          <p className="text-sm leading-6 text-slate-600">
            Wir haben einen Anmeldelink und einen sechsstelligen Code an <strong className="font-semibold text-slate-900">{email}</strong> gesendet.
          </p>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-800">Einmalcode</span>
          <input
            autoFocus
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-2xl font-semibold tracking-[0.35em] text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            aria-describedby={message ? "portal-login-message" : undefined}
          />
        </label>
        {message && (
          <p id="portal-login-message" className="rounded-lg bg-slate-100 px-3 py-2 text-sm leading-5 text-slate-600" role="status">
            {message}
          </p>
        )}
        <button
          disabled={busy || code.length !== 6}
          className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Code wird geprüft …" : "Sicher anmelden"}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setStep("email"); setCode(""); setMessage(""); }} className="text-slate-500 hover:text-slate-900">
            Andere E-Mail
          </button>
          <button type="button" disabled={busy} onClick={() => void sendCode()} className="font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50">
            Code erneut senden
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-800">E-Mail-Adresse</span>
        <input
          autoFocus
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@unternehmen.at"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          aria-describedby={message ? "portal-login-message" : undefined}
        />
      </label>
      {message && (
        <p id="portal-login-message" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {message}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Zugang wird angefordert …" : "Einmalcode anfordern"}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">
        Kein Passwort nötig. Der Zugangscode ist 10 Minuten gültig.
      </p>
    </form>
  );
}
