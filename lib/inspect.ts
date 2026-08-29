import dns from "node:dns/promises";
import net from "node:net";
import * as cheerio from "cheerio";

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

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

function isPrivateIp(ip: string) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
}

async function assertPublicHttpUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid absolute URL, including https://");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Local or private network addresses are not supported.");
  }

  if (net.isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("Private network addresses are not supported.");
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("This hostname resolves to a private or unsupported network.");
  }

  return parsed;
}

async function fetchPublicPage(rawUrl: string) {
  let currentUrl = (await assertPublicHttpUrl(rawUrl)).toString();

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    await assertPublicHttpUrl(currentUrl);

    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "user-agent": "SiteScope/0.1 (+https://github.com/ArViskas/sitescope-webmcp)",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5"
      },
      signal: AbortSignal.timeout(10_000)
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: currentUrl };

      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error("Too many redirects.");
}

function clean(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

export async function inspectPublicPage(rawUrl: string): Promise<PageInspection> {
  const requestedUrl = (await assertPublicHttpUrl(rawUrl)).toString();
  const { response, finalUrl } = await fetchPublicPage(requestedUrl);
  const contentType = response.headers.get("content-type");

  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > 2_500_000) {
    throw new Error("The page is too large for this early SiteScope prototype.");
  }

  const html =
    contentType?.includes("text/html") || contentType?.includes("application/xhtml+xml")
      ? await response.text()
      : "";

  const $ = cheerio.load(html);
  const title = clean($("title").first().text());
  const metaDescription = clean(
    $('meta[name="description"]').first().attr("content")
  );
  const h1 = clean($("h1").first().text());
  const canonicalHref = clean($('link[rel="canonical"]').first().attr("href"));
  const robots = clean($('meta[name="robots"]').first().attr("content"));
  const canonical = canonicalHref
    ? new URL(canonicalHref, finalUrl).toString()
    : null;

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
