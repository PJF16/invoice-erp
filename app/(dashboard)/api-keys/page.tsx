import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiKeyManager } from "@/components/api-key-manager";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">API &amp; Integrationen</h1>
      <p className="mb-6 text-sm text-gray-500">Zugriffsschlüssel verwalten und die REST-API dokumentieren.</p>
      <ApiKeyManager initialKeys={apiKeys.map((key) => ({
        ...key,
        createdAt: key.createdAt.toISOString(),
        lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        expiresAt: key.expiresAt?.toISOString() ?? null,
      }))} />
    </div>
  );
}
