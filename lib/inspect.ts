import * as cheerio from "cheerio";
import { assertPublicHttpUrl, fetchPublicResource } from "@/lib/public-fetch";

const MAX_PAGE_BYTES = 2_500_000;

export type PageInspection = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  robots: string | null;
  indexStatus: "index" | "noindex";
  contentType: string | null;
};

function clean(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

export async function inspectPublicPage(rawUrl: string): Promise<PageInspection> {
  const requestedUrl = (await assertPublicHttpUrl(rawUrl)).toString();
  const response = await fetchPublicResource(requestedUrl, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    maxBytes: MAX_PAGE_BYTES
  });
  const { contentType, finalUrl } = response;
  const html =
    contentType?.includes("text/html") || contentType?.includes("application/xhtml+xml")
      ? response.body.toString("utf8")
      : "";

  const $ = cheerio.load(html);
  const title = clean($("title").first().text());
  const metaDescription = clean(
    $('meta[name="description"]').first().attr("content")
  );
  const h1 = clean($("h1").first().text());
  const canonicalHref = clean($('link[rel="canonical"]').first().attr("href"));
  const robots = clean($('meta[name="robots"]').first().attr("content"));
  let canonical: string | null = null;
  if (canonicalHref) {
    try {
      canonical = new URL(canonicalHref, finalUrl).toString();
    } catch {
      canonical = null;
    }
  }

  return {
    requestedUrl,
    finalUrl,
    status: response.status,
    title,
    metaDescription,
    h1,
    canonical,
    robots,
    indexStatus: robots && /(^|,)\s*noindex\b/i.test(robots) ? "noindex" : "index",
    contentType
  };
}
