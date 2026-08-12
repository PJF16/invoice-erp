"use client";

import { useState } from "react";

export function PortalLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/portal/auth/logout", { method: "POST" });
    window.location.assign("/portal/login");
  }

  return (
    <button onClick={logout} disabled={busy} className="text-sm font-medium text-slate-600 transition hover:text-slate-950 disabled:opacity-50">
      {busy ? "Abmelden …" : "Abmelden"}
    </button>
  );
}
