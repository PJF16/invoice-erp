import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasModule, type ModuleName } from "@/lib/permissions";

export async function requirePageModule(module: ModuleName) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasModule(session.user, module)) redirect("/");
  return session;
}
