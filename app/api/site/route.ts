import { NextResponse } from "next/server";
import { listSitePages, scanSite } from "@/lib/sitemap";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      mode?: unknown;
      url?: unknown;
    };

    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json(
        { error: "A public site URL is required." },
        { status: 400 }
      );
    }

    if (body.mode === "scan") {
      return NextResponse.json(await scanSite(body.url.trim()));
    }

    if (body.mode === "list") {
      return NextResponse.json(await listSitePages(body.url.trim()));
    }

    return NextResponse.json(
      { error: 'Mode must be either "scan" or "list".' },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to scan this site.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
