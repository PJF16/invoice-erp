import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/components/portal-login-form";
import { getPortalSession } from "@/lib/portal-auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getPortalSession()) redirect("/portal");
  const [settings, params] = await Promise.all([getSettings(), searchParams]);
  const company = settings.name || "Kundenportal";
  const error = params.error === "link" ? "Der Anmeldelink ist ungültig oder abgelaufen. Fordern Sie bitte einen neuen an." : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div aria-hidden="true" className="absolute inset-0 opacity-80 [background:radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.35),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(14,165,233,0.22),transparent_32%)]" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-gradient-to-br from-blue-800 via-blue-700 to-cyan-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-bold ring-1 ring-white/20">{company.slice(0, 1).toUpperCase()}</div>
            <p className="mt-5 text-sm font-medium text-blue-100">{company}</p>
          </div>
          <div>
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Ihre Rechnungen und Dienste an einem Ort.</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-blue-100">Belege einsehen, Zahlungsstatus prüfen und laufende Services transparent im Blick behalten.</p>
          </div>
          <p className="text-xs text-blue-100/80">Sicherer Zugang ohne Passwort</p>
        </section>
        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-8 lg:hidden">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 font-bold text-white">{company.slice(0, 1).toUpperCase()}</div>
            <p className="mt-3 text-sm font-semibold text-slate-900">{company}</p>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Kundenportal</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Willkommen zurück</h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-slate-600">Melden Sie sich mit der E-Mail-Adresse an, die bei uns hinterlegt ist.</p>
          <PortalLoginForm initialError={error} />
        </section>
      </div>
    </main>
  );
}
