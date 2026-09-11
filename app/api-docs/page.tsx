import { openApiDocument } from "@/lib/openapi";

export const metadata = { title: "API-Dokumentation · invoice-erp" };

type ApiOperation = { summary?: string; description?: string; tags?: string[] };

export default function ApiDocsPage() {
  const grouped = new Map<string, { method: string; path: string; summary: string; description?: string }[]>();
  for (const [route, methods] of Object.entries(openApiDocument.paths)) {
    for (const [method, rawOperation] of Object.entries(methods)) {
      const operation = rawOperation as ApiOperation;
      const tag = operation.tags?.[0] ?? "Weitere";
      const entries = grouped.get(tag) ?? [];
      entries.push({ method: method.toUpperCase(), path: route, summary: operation.summary ?? "", description: operation.description });
      grouped.set(tag, entries);
    }
  }

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <div className="mb-8 rounded-2xl bg-gray-950 p-7 text-white shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">REST API · OpenAPI 3.1</p>
        <h1 className="text-3xl font-semibold">invoice-erp API</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
          Die API deckt Lager, Kunden, Lieferscheine, Angebote, Rechnungen, Zahlungen, Exporte und Administration ab.
          Sie verwendet dieselbe geprüfte Geschäftslogik wie die Weboberfläche und die iOS-App.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/api/openapi" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900">OpenAPI-JSON öffnen</a>
          <a href="/docs/API.md" className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-white">Integrationsleitfaden</a>
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Authentifizierung</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">Unter API &amp; Integrationen einen Schlüssel erzeugen und bei jeder Anfrage mitsenden:</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100"><code>{`Authorization: Bearer ierp_…`}</code></pre>
          <p className="mt-3 text-xs text-gray-500">Alternativ funktionieren bestehende Auth.js-Session-Cookies. API-Schlüssel übernehmen Rolle und Modulrechte ihres Benutzers.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Erste Anfrage</h2>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-5 text-gray-100"><code>{`curl https://erp.example.com/api/me \\
  -H 'Authorization: Bearer ierp_IHR_SCHLUESSEL'`}</code></pre>
          <p className="mt-3 text-xs text-gray-500">JSON-Datumswerte verwenden ISO-8601. Geldbeträge werden als Dezimalzahlen in EUR übertragen.</p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <h2 className="font-semibold">Wichtige Workflows</h2>
        <p className="mt-1">Angebote und Rechnungen entstehen als Entwurf. Erst <code>POST …/finalize</code> vergibt eine Nummer und friert Kundendaten ein; bei Rechnungen wird dort Hardware gebucht. Zum Stornieren immer den Status <code>CANCELED</code> setzen – dadurch entsteht die gesetzlich korrekte Stornorechnung. Bestand niemals über Datenbankzugriffe verändern, sondern ausschließlich über Bewegungs-, Lieferschein- oder Rechnungsendpunkte.</p>
      </section>

      {[...grouped.entries()].map(([tag, operations]) => (
        <section key={tag} className="mb-7 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <h2 className="border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-semibold">{tag}</h2>
          <div className="divide-y divide-gray-100">
            {operations.map((operation) => (
              <div key={`${operation.method}-${operation.path}`} className="grid gap-1 px-5 py-3 md:grid-cols-[5rem_22rem_1fr] md:gap-3">
                <span className={`w-fit rounded px-2 py-0.5 font-mono text-xs font-bold ${operation.method === "GET" ? "bg-blue-100 text-blue-800" : operation.method === "DELETE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{operation.method}</span>
                <code className="break-all text-sm text-gray-900">{operation.path}</code>
                <span className="text-sm text-gray-600">{operation.summary}{operation.description ? ` — ${operation.description}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
