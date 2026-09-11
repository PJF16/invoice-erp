import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { hasModule, type ModuleName } from "@/lib/permissions";
import { headers } from "next/headers";
import { authenticateApiKey, readBearerToken } from "@/lib/api-keys";
import { Prisma } from "@/lib/generated/prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function requireSession(): Promise<Session> {
  const token = readBearerToken((await headers()).get("authorization"));
  if (token) {
    const user = await authenticateApiKey(token);
    if (!user) throw new ApiError(401, "Ungültiger oder abgelaufener API-Schlüssel", "INVALID_API_KEY");
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: null,
        role: user.role,
        modules: user.modules,
      },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    };
  }
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

export function getPagination(searchParams: URLSearchParams, defaults = { limit: 200, max: 500 }) {
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");
  const limit = rawLimit == null ? defaults.limit : Number(rawLimit);
  const offset = rawOffset == null ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > defaults.max) {
    throw new ApiError(400, `limit muss eine ganze Zahl zwischen 1 und ${defaults.max} sein`, "INVALID_PAGINATION");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiError(400, "offset muss eine nichtnegative ganze Zahl sein", "INVALID_PAGINATION");
  }
  return { take: limit, skip: offset };
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...error.details },
      { status: error.status },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Datensatz nicht gefunden", code: "NOT_FOUND" }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Ein Datensatz mit diesem eindeutigen Wert existiert bereits", code: "CONFLICT" }, { status: 409 });
    }
    if (error.code === "P2003") {
      return NextResponse.json({ error: "Datensatz wird noch verwendet und kann nicht gelöscht werden", code: "IN_USE" }, { status: 409 });
    }
  }
  console.error(error);
  return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
}
