import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kundenportal",
  description: "Rechnungen, Zahlungsstatus und abonnierte Dienste",
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
