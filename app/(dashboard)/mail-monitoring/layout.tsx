import { requirePageModule } from "@/lib/require-page-module";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requirePageModule("INVOICES");
  return <>{children}</>;
}
