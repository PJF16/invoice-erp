"use client";

import { useState } from "react";

export function PortalImpersonationExit() {
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    const response = await fetch("/api/portal/impersonation", { method: "DELETE" });
    if (response.ok) {
      window.location.assign("/customers");
      return;
    }
    setBusy(false);
    alert("Kundensicht konnte nicht verlassen werden.");
  }

  return (
    <button
      onClick={leave}
      disabled={busy}
      className="rounded-lg bg-amber-950 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
    >
      {busy ? "Wechsle zurück …" : "Kundensicht verlassen"}
    </button>
  );
}
