import * as cheerio from "cheerio";
import { fetchPublicResource } from "@/lib/public-fetch";
import { listSitePages } from "@/lib/sitemap";

const MAX_SOURCE_PAGES = 8;
const MAX_TARGET_LINKS = 40;
const MAX_HTML_BYTES = 750_000;
const CHECK_CONCURRENCY = 5;

const NON_PAGE_EXTENSION =
  /\.(?:avif|bmp|css|csv|docx?|eot|gif|ico|jpe?g|js|json|mp3|mp4|mov|ogg|pdf|png|pptx?|rar|svg|tar|tiff?|ttf|webm|webp|woff2?|xlsx?|xml|zip)$/i;

export type BrokenLink = {
  url: string;
  status: number;
  finalUrl: string;
  sourcePages: string[];
};

export type BrokenLinkReport = {
  requestedUrl: string;
  sitemapPagesDiscovered: number;
  sourcePagesSelected: number;
  sourcePagesFetched: number;
  internalLinksFound: number;
  linksChecked: number;
  unverifiedLinks: number;
  brokenLinksFound: number;
  truncated: boolean;
  brokenLinks: BrokenLink[];
  limits: {
    maxSourcePages: number;
    maxTargetLinks: number;
    maxHtmlBytes: number;
    concurrency: number;
  };
};

function normalizeInternalLink(
  href: string,
  baseUrl: string,
  allowedHostnames: Set<string>
) {
  let parsed: URL;

  try {
    parsed = new URL(href, baseUrl);
  } catch {
    return null;
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    !allowedHostnames.has(parsed.hostname.toLowerCase()) ||
    NON_PAGE_EXTENSION.test(parsed.pathname)
  ) {
    return null;
  }

  parsed.hash = "";
  return parsed.toString();
}

async function extractInternalLinks(
  sourceUrl: string,
  allowedHostnames: Set<string>
) {
  try {
    const resource = await fetchPublicResource(sourceUrl, {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.2",
      maxBytes: MAX_HTML_BYTES
    });

    if (
      resource.status < 200 ||
      resource.status >= 400 ||
      (!resource.contentType?.includes("text/html") &&
        !resource.contentType?.includes("application/xhtml+xml"))
    ) {
      return { fetched: false, links: [] as string[] };
    }

    const $ = cheerio.load(resource.body.toString("utf8"));
    const links = new Set<string>();

    $("a[href]").each((_index, element) => {
      const href = $(element).attr("href");
      if (!href) return;

      const normalized = normalizeInternalLink(
        href,
        resource.finalUrl,
        allowedHostnames
      );
      if (normalized) links.add(normalized);
    });

    return { fetched: true, links: [...links] };
  } catch {
    return { fetched: false, links: [] as string[] };
  }
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += size) {
    const batch = items.slice(index, index + size);
    results.push(...(await Promise.all(batch.map(worker))));
  }

  return results;
}

export async function findBrokenLinks(rawUrl: string): Promise<BrokenLinkReport> {
  const pageList = await listSitePages(rawUrl);
  const sourcePages = pageList.pages.slice(0, MAX_SOURCE_PAGES);
  const allowedHostnames = new Set<string>([
    new URL(pageList.summary.siteOrigin).hostname.toLowerCase(),
    ...pageList.pages.map((page) => new URL(page.url).hostname.toLowerCase())
  ]);

  const sourceResults = await Promise.all(
    sourcePages.map(async (page) => ({
      sourceUrl: page.url,
      ...(await extractInternalLinks(page.url, allowedHostnames))
    }))
  );

  const targetSources = new Map<string, Set<string>>();
  let truncated = pageList.summary.truncated;

  for (const source of sourceResults) {
    for (const targetUrl of source.links) {
      if (!targetSources.has(targetUrl) && targetSources.size >= MAX_TARGET_LINKS) {
        truncated = true;
        continue;
      }

      const sources = targetSources.get(targetUrl) ?? new Set<string>();
      if (sources.size < 3) sources.add(source.sourceUrl);
      targetSources.set(targetUrl, sources);
    }
  }

  const targets = [...targetSources.keys()];
  let unverifiedLinks = 0;

  const checks = await inBatches(
    targets,
    CHECK_CONCURRENCY,
    async (targetUrl) => {
      try {
        const resource = await fetchPublicResource(targetUrl, {
          accept: "text/html,application/xhtml+xml;q=0.8,*/*;q=0.2",
          maxBytes: MAX_HTML_BYTES
        });

        return {
          targetUrl,
          status: resource.status,
          finalUrl: resource.finalUrl
        };
      } catch {
        unverifiedLinks += 1;
        return null;
      }
    }
  );

  const brokenLinks: BrokenLink[] = [];

  for (const check of checks) {
    if (!check || check.status < 400) continue;

    brokenLinks.push({
      url: check.targetUrl,
      status: check.status,
      finalUrl: check.finalUrl,
      sourcePages: [...(targetSources.get(check.targetUrl) ?? [])]
    });
  }

  return {
    requestedUrl: pageList.summary.requestedUrl,
    sitemapPagesDiscovered: pageList.summary.pagesDiscovered,
    sourcePagesSelected: sourcePages.length,
    sourcePagesFetched: sourceResults.filter((result) => result.fetched).length,
    internalLinksFound: targetSources.size,
    linksChecked: checks.filter(Boolean).length,
    unverifiedLinks,
    brokenLinksFound: brokenLinks.length,
    truncated,
    brokenLinks,
    limits: {
      maxSourcePages: MAX_SOURCE_PAGES,
      maxTargetLinks: MAX_TARGET_LINKS,
      maxHtmlBytes: MAX_HTML_BYTES,
      concurrency: CHECK_CONCURRENCY
    }
  };
}
