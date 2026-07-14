import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { hasModule, type ModuleName } from "@/lib/permissions";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Nicht angemeldet");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new ApiError(403, "Keine Berechtigung");
  return session;
}

export async function requireModule(module: ModuleName): Promise<Session> {
  const session = await requireSession();
  if (!hasModule(session.user, module)) throw new ApiError(403, "Keine Berechtigung");
  return session;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
}
