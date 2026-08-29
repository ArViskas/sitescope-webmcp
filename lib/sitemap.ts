import { gunzipSync } from "node:zlib";
import * as cheerio from "cheerio";
import { assertPublicHttpUrl, fetchPublicResource } from "@/lib/public-fetch";

const MAX_SITEMAP_BYTES = 6_000_000;
const MAX_SITEMAPS = 10;
const MAX_SITEMAP_DEPTH = 2;
const MAX_PAGES = 500;

export type SitemapPage = {
  url: string;
  lastModified: string | null;
};

export type SiteScanSummary = {
  requestedUrl: string;
  siteOrigin: string;
  sitemapFound: boolean;
  sitemapUrl: string | null;
  sitemapType: "urlset" | "index" | "none";
  sitemapsAttempted: number;
  sitemapsProcessed: number;
  sitemapsSkipped: number;
  pagesDiscovered: number;
  truncated: boolean;
  limits: {
    maxSitemaps: number;
    maxDepth: number;
    maxPages: number;
    maxBytesPerSitemap: number;
  };
};

export type SitePageList = {
  summary: SiteScanSummary;
  pages: SitemapPage[];
};

type ParsedSitemap =
  | { type: "index"; sitemaps: string[] }
  | { type: "urlset"; pages: SitemapPage[] }
  | { type: "none" };

function parseHttpUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sitemapText(
  body: Buffer,
  contentEncoding: string | null,
  contentType: string | null,
  finalUrl: string
) {
  const isGzip =
    contentEncoding?.toLowerCase().includes("gzip") ||
    contentType?.toLowerCase().includes("gzip") ||
    new URL(finalUrl).pathname.toLowerCase().endsWith(".gz");

  if (!isGzip) return body.toString("utf8");

  try {
    return gunzipSync(body, { maxOutputLength: MAX_SITEMAP_BYTES }).toString("utf8");
  } catch {
    throw new Error("The compressed sitemap is invalid or exceeds the size limit.");
  }
}

function parseSitemap(xml: string): ParsedSitemap {
  const $ = cheerio.load(xml, { xmlMode: true });

  if ($("sitemapindex").length) {
    const sitemaps: string[] = [];
    $("sitemap").each((_index, element) => {
      if (sitemaps.length >= MAX_SITEMAPS + 1) return false;
      const location = $(element).children("loc").first().text().trim();
      if (location) sitemaps.push(location);
    });
    return { type: "index", sitemaps };
  }

  if ($("urlset").length) {
    const pages: SitemapPage[] = [];
    $("url").each((_index, element) => {
      if (pages.length >= MAX_PAGES + 1) return false;
      const location = $(element).children("loc").first().text().trim();
      if (!location) return;
      const lastModified =
        $(element).children("lastmod").first().text().trim() || null;
      pages.push({ url: location, lastModified });
    });
    return { type: "urlset", pages };
  }

  return { type: "none" };
}

async function scanPublicSite(rawUrl: string) {
  const requestedUrl = (await assertPublicHttpUrl(rawUrl)).toString();
  const requested = new URL(requestedUrl);
  const rootSitemapUrl = /\.xml(?:\.gz)?$/i.test(requested.pathname)
    ? requestedUrl
    : new URL("/sitemap.xml", requested.origin).toString();
  const allowedHostnames = new Set([requested.hostname.toLowerCase()]);
  const queue: Array<{ url: string; depth: number }> = [
    { url: rootSitemapUrl, depth: 0 }
  ];
  const visited = new Set<string>();
  const pages = new Map<string, SitemapPage>();

  let sitemapFound = false;
  let sitemapUrl: string | null = null;
  let sitemapType: SiteScanSummary["sitemapType"] = "none";
  let sitemapsAttempted = 0;
  let sitemapsProcessed = 0;
  let sitemapsSkipped = 0;
  let truncated = false;

  while (queue.length && sitemapsAttempted < MAX_SITEMAPS && pages.size < MAX_PAGES) {
    const next = queue.shift();
    if (!next || visited.has(next.url)) continue;
    visited.add(next.url);
    sitemapsAttempted += 1;

    let resource;
    try {
      resource = await fetchPublicResource(next.url, {
        accept: "application/xml,text/xml,application/x-gzip,text/plain;q=0.8,*/*;q=0.2",
        maxBytes: MAX_SITEMAP_BYTES
      });
    } catch (error) {
      if (next.depth === 0) throw error;
      sitemapsSkipped += 1;
      continue;
    }

    if (resource.status < 200 || resource.status >= 300) {
      sitemapsSkipped += 1;
      continue;
    }

    const finalUrl = new URL(resource.finalUrl);
    const finalHostname = finalUrl.hostname.toLowerCase();
    if (next.depth === 0) {
      allowedHostnames.add(finalHostname);
    }

    const parsed = parseSitemap(
      sitemapText(
        resource.body,
        resource.contentEncoding,
        resource.contentType,
        resource.finalUrl
      )
    );

    if (parsed.type === "none") {
      sitemapsSkipped += 1;
      continue;
    }

    sitemapsProcessed += 1;
    if (next.depth === 0) {
      sitemapFound = true;
      sitemapUrl = resource.finalUrl;
      sitemapType = parsed.type;
    }

    if (parsed.type === "index") {
      for (const child of parsed.sitemaps) {
        if (sitemapsAttempted + queue.length >= MAX_SITEMAPS) {
          truncated = true;
          sitemapsSkipped += 1;
          continue;
        }
        const childUrl = parseHttpUrl(child);
        if (!childUrl) {
          sitemapsSkipped += 1;
          continue;
        }
        if (next.depth >= MAX_SITEMAP_DEPTH) {
          truncated = true;
          sitemapsSkipped += 1;
          continue;
        }
        queue.push({ url: childUrl.toString(), depth: next.depth + 1 });
      }
      continue;
    }

    for (const page of parsed.pages) {
      if (pages.size >= MAX_PAGES) {
        truncated = true;
        break;
      }
      const pageUrl = parseHttpUrl(page.url);
      if (!pageUrl || !allowedHostnames.has(pageUrl.hostname.toLowerCase())) continue;
      const normalizedUrl = pageUrl.toString();
      if (!pages.has(normalizedUrl)) {
        pages.set(normalizedUrl, { ...page, url: normalizedUrl });
      }
    }
  }

  if (queue.length) truncated = true;

  const summary: SiteScanSummary = {
    requestedUrl,
    siteOrigin: requested.origin,
    sitemapFound,
    sitemapUrl,
    sitemapType,
    sitemapsAttempted,
    sitemapsProcessed,
    sitemapsSkipped,
    pagesDiscovered: pages.size,
    truncated,
    limits: {
      maxSitemaps: MAX_SITEMAPS,
      maxDepth: MAX_SITEMAP_DEPTH,
      maxPages: MAX_PAGES,
      maxBytesPerSitemap: MAX_SITEMAP_BYTES
    }
  };

  return { summary, pages: [...pages.values()] };
}

export async function scanSite(rawUrl: string): Promise<SiteScanSummary> {
  return (await scanPublicSite(rawUrl)).summary;
}

export async function listSitePages(rawUrl: string): Promise<SitePageList> {
  const { summary, pages } = await scanPublicSite(rawUrl);
  return { summary, pages };
}
