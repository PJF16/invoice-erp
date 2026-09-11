import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/openapi";

export async function GET() {
  return NextResponse.json(openApiDocument, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
