import { NextResponse } from "next/server";
import { inspectPublicPage } from "@/lib/inspect";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };

    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { error: "A website URL is required." },
        { status: 400 }
      );
    }

    const result = await inspectPublicPage(body.url.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to inspect this page.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
