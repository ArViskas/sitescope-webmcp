"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type WebMcpActivityEntry = {
  id: number;
  tool: "inspect_page" | "scan_site" | "list_pages" | "find_broken_links" | "create_migration_plan";
  url: string;
  status: "running" | "complete" | "error";
  lines: string[];
};

type Inspection = {
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

type SiteScanSummary = {
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
};

type SitePageList = {
  summary: SiteScanSummary;
  pages: Array<{
    url: string;
    lastModified: string | null;
  }>;
};

type BrokenLinkReport = {
  requestedUrl: string;
  sitemapPagesDiscovered: number;
  sourcePagesSelected: number;
  sourcePagesFetched: number;
  internalLinksFound: number;
  linksChecked: number;
  unverifiedLinks: number;
  brokenLinksFound: number;
  truncated: boolean;
  brokenLinks: Array<{
    url: string;
    status: number;
    finalUrl: string;
    sourcePages: string[];
  }>;
};

type MigrationPlan = {
  requestedUrl: string;
  siteOrigin: string;
  pagesDiscovered: number;
  inventoryTruncated: boolean;
  priorityPagesSelected: number;
  priorityPagesInspected: number;
  riskCount: number;
  risks: Array<{
    level: "high" | "medium";
    code: string;
    url: string | null;
    detail: string;
  }>;
  priorityPages: Array<{
    url: string;
    status: number | null;
    finalUrl: string | null;
    title: string | null;
    h1: string | null;
    metaDescription: string | null;
    canonical: string | null;
    indexStatus: "index" | "noindex" | null;
    inspectionError: string | null;
  }>;
  actions: Array<{
    priority: "critical" | "high" | "medium";
    action: string;
    reason: string;
  }>;
  recommendedFollowUpTools: string[];
};

async function inspect(url: string, signal?: AbortSignal): Promise<Inspection> {
  const response = await fetch("/api/inspect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Inspection failed.");
  }

  return data;
}

async function siteRequest<T>(
  mode: "scan" | "list" | "broken" | "migration",
  url: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch("/api/site", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, url }),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Site scan failed.");
  }

  return data;
}

export default function Home() {
  const [url, setUrl] = useState("https://example.com");
  const [result, setResult] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [siteUrl, setSiteUrl] = useState("https://nextjs.org");
  const [siteResult, setSiteResult] = useState<SitePageList | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://nextjs.org");
  const [linkResult, setLinkResult] = useState<BrokenLinkReport | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [migrationUrl, setMigrationUrl] = useState("https://nextjs.org");
  const [migrationResult, setMigrationResult] = useState<MigrationPlan | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [webMcpDetected, setWebMcpDetected] = useState(false);
  const [webMcpActivity, setWebMcpActivity] = useState<WebMcpActivityEntry[]>([]);
  const activitySequence = useRef(0);
  const activityLogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const log = activityLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [webMcpActivity]);


  useEffect(() => {
    const modelContext = document.modelContext;
    setWebMcpDetected(Boolean(modelContext?.registerTool));

    if (!modelContext?.registerTool) return;

    const urlInputSchema = {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Absolute public site URL beginning with http:// or https://"
        }
      },
      required: ["url"],
      additionalProperties: false
    };
    const annotations = {
      readOnlyHint: true,
      untrustedContentHint: true
    };

    function beginActivity(tool: WebMcpActivityEntry["tool"], toolUrl: string) {
      const id = ++activitySequence.current;
      const nextEntry: WebMcpActivityEntry = {
        id,
        tool,
        url: toolUrl,
        status: "running",
        lines: []
      };
      setWebMcpActivity((entries) => [...entries, nextEntry].slice(-8));
      return id;
    }

    function finishActivity(id: number, lines: string[]) {
      setWebMcpActivity((entries) =>
        entries.map((entry) =>
          entry.id === id ? { ...entry, status: "complete", lines } : entry
        )
      );
    }

    function failActivity(id: number, error: unknown) {
      setWebMcpActivity((entries) =>
        entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "error",
                lines: [error instanceof Error ? error.message : "Tool call failed."]
              }
            : entry
        )
      );
    }

    async function tracked<T>(
      tool: WebMcpActivityEntry["tool"],
      toolUrl: string,
      run: () => Promise<T>,
      summarize: (result: T) => string[]
    ) {
      const id = beginActivity(tool, toolUrl);
      try {
        const result = await run();
        finishActivity(id, summarize(result));
        return result;
      } catch (caught) {
        failActivity(id, caught);
        throw caught;
      }
    }

    const tools = [
      {
        name: "inspect_page",
        description:
          "Inspect a public webpage and return its HTTP status, title, H1, meta description, canonical URL, robots directive, and index status.",
        inputSchema: urlInputSchema,
        annotations,
        execute: async (
          { url: toolUrl }: { url: string },
          { signal }: { signal: AbortSignal }
        ) =>
          tracked("inspect_page", toolUrl, () => inspect(toolUrl, signal), (result) => [
            `${result.status} · ${result.finalUrl}`,
            result.title ? `Title: ${result.title}` : "Title: not found"
          ])
      },
      {
        name: "scan_site",
        description:
          "Discover a public site's sitemap and return a concise bounded scan summary.",
        inputSchema: urlInputSchema,
        annotations,
        execute: async (
          { url: toolUrl }: { url: string },
          { signal }: { signal: AbortSignal }
        ) =>
          tracked(
            "scan_site",
            toolUrl,
            () => siteRequest<SiteScanSummary>("scan", toolUrl, signal),
            (result) => [
              `${result.pagesDiscovered} pages discovered`,
              result.sitemapUrl ? `Sitemap: ${result.sitemapUrl}` : "Sitemap: not found"
            ]
          )
      },
      {
        name: "list_pages",
        description:
          "Discover a public site's sitemap and return its bounded structured page URL list.",
        inputSchema: urlInputSchema,
        annotations,
        execute: async (
          { url: toolUrl }: { url: string },
          { signal }: { signal: AbortSignal }
        ) =>
          tracked(
            "list_pages",
            toolUrl,
            () => siteRequest<SitePageList>("list", toolUrl, signal),
            (result) => {
              const urls = result.pages.slice(0, 12).map((page) => page.url);
              if (result.pages.length > urls.length) {
                urls.push(`+${result.pages.length - urls.length} more URLs`);
              }
              return [`${result.summary.pagesDiscovered} pages discovered`, ...urls];
            }
          )
      },
      {
        name: "find_broken_links",
        description:
          "Check a bounded sample of internal page links and report verified 4xx/5xx targets with their source pages.",
        inputSchema: urlInputSchema,
        annotations,
        execute: async (
          { url: toolUrl }: { url: string },
          { signal }: { signal: AbortSignal }
        ) =>
          tracked(
            "find_broken_links",
            toolUrl,
            () => siteRequest<BrokenLinkReport>("broken", toolUrl, signal),
            (result) => [
              `${result.brokenLinksFound} broken link${result.brokenLinksFound === 1 ? "" : "s"} found`,
              ...result.brokenLinks.flatMap((link) => [
                `${link.status} · ${link.url}`,
                `Source${link.sourcePages.length === 1 ? "" : "s"}: ${link.sourcePages.join(", ")}`
              ])
            ]
          )
      },
      {
        name: "create_migration_plan",
        description:
          "Create a bounded migration-readiness plan from sitemap inventory and representative page metadata.",
        inputSchema: urlInputSchema,
        annotations,
        execute: async (
          { url: toolUrl }: { url: string },
          { signal }: { signal: AbortSignal }
        ) =>
          tracked(
            "create_migration_plan",
            toolUrl,
            () => siteRequest<MigrationPlan>("migration", toolUrl, signal),
            (result) => [
              `${result.riskCount} migration risks found`,
              ...result.risks.slice(0, 5).map(
                (risk) =>
                  `Risk: ${risk.level.toUpperCase()} · ${risk.code}${risk.url ? ` · ${risk.url}` : ""}`
              ),
              ...result.actions.slice(0, 3).map(
                (action, index) =>
                  `Action ${index + 1}: ${action.action}`
              )
            ]
          )
      }
    ];

    const controller = new AbortController();
    void Promise.all(
      tools.map((tool) =>
        modelContext.registerTool(tool, { signal: controller.signal })
      )
    ).catch(() => {
      // A development hot reload can briefly overlap tool registrations.
    });

    return () => {
      controller.abort();
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      setResult(await inspect(url));
    } catch (caught) {
      setResult(null);
      setError(caught instanceof Error ? caught.message : "Inspection failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onSiteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSiteLoading(true);
    setSiteError(null);

    try {
      setSiteResult(await siteRequest<SitePageList>("list", siteUrl));
    } catch (caught) {
      setSiteResult(null);
      setSiteError(caught instanceof Error ? caught.message : "Site scan failed.");
    } finally {
      setSiteLoading(false);
    }
  }

  async function onBrokenLinksSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkLoading(true);
    setLinkError(null);

    try {
      setLinkResult(await siteRequest<BrokenLinkReport>("broken", linkUrl));
    } catch (caught) {
      setLinkResult(null);
      setLinkError(
        caught instanceof Error ? caught.message : "Broken-link check failed."
      );
    } finally {
      setLinkLoading(false);
    }
  }

  async function onMigrationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMigrationLoading(true);
    setMigrationError(null);

    try {
      setMigrationResult(
        await siteRequest<MigrationPlan>("migration", migrationUrl)
      );
    } catch (caught) {
      setMigrationResult(null);
      setMigrationError(
        caught instanceof Error ? caught.message : "Migration plan failed."
      );
    } finally {
      setMigrationLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand" aria-label="SiteScope by Kitoki">
          <span className="brandWord">
            SiteScope<span className="brandDot">.</span>
          </span>
          <span className="brandBy">by Kitoki</span>
        </div>
        <span className={webMcpDetected ? "status statusOk" : "status"}>
          <span className="statusDot" />
          {webMcpDetected ? "WebMCP detected" : "Standard browser"}
        </span>
      </header>

      <section className="hero">
        <p className="eyebrow">WebMCP website intelligence</p>
        <h1>Understand a website before you change it.</h1>
        <p className="lede">
          Inspect a live site, map its public pages, check link health, and prepare
          a migration baseline - through the interface or directly through WebMCP.
        </p>

        <div className="heroFlow" aria-label="SiteScope workflow">
          <span>Inspect</span>
          <span>Discover</span>
          <span>Check</span>
          <span>Plan</span>
        </div>

        <form className="scanForm" onSubmit={onSubmit}>
          <label htmlFor="url">Public webpage URL</label>
          <div className="inputRow">
            <input
              id="url"
              name="url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Inspecting…" : "Inspect page"}
            </button>
          </div>
        </form>

        {error && <div className="error" role="alert">{error}</div>}

        <section className="webMcpActivity" aria-live="polite">
          <div className="activityHeader">
            <div>
              <span className="activityKicker">Live WebMCP activity</span>
              <strong>{webMcpActivity.length ? "Real agent calls" : "Waiting for agent calls"}</strong>
            </div>
            <button
              type="button"
              className="clearActivity"
              onClick={() =>
                setWebMcpActivity((entries) =>
                  entries.filter((entry) => entry.status === "running")
                )
              }
              disabled={
                !webMcpActivity.length ||
                webMcpActivity.some((entry) => entry.status === "running")
              }
            >
              Clear activity
            </button>
          </div>

          <div className="activityLog" ref={activityLogRef}>
            {!webMcpActivity.length ? (
              <p className="activityEmpty">
                Native WebMCP calls will appear here as they run.
              </p>
            ) : (
              webMcpActivity.map((entry) => (
                <article className="activityEntry" key={entry.id}>
                  <div className="activityEntryTop">
                    <code>{entry.tool}</code>
                    <span className={`activityState activityState-${entry.status}`}>
                      {entry.status === "running"
                        ? "Running…"
                        : entry.status === "complete"
                          ? "Complete"
                          : "Error"}
                    </span>
                  </div>
                  <div className="activityUrl">{entry.url}</div>
                  {entry.lines.length > 0 && (
                    <ul className="activityLines">
                      {entry.lines.map((line, index) => (
                        <li key={`${entry.id}-${index}`}>{line}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </section>

      <section className="resultsSection" aria-live="polite">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">01 / Inspect</p>
            <h2>Page inspection</h2>
          </div>
          <code>inspect_page</code>
        </div>

        {!result ? (
          <div className="emptyState">
            <p>Run an inspection to see structured website data here.</p>
          </div>
        ) : (
          <div className="resultsGrid">
            <ResultCard label="HTTP status" value={String(result.status)} />
            <ResultCard label="Index status" value={result.indexStatus} />
            <ResultCard label="Title" value={result.title} wide />
            <ResultCard label="H1" value={result.h1} wide />
            <ResultCard label="Meta description" value={result.metaDescription} wide />
            <ResultCard label="Canonical" value={result.canonical} wide mono />
            <ResultCard label="Final URL" value={result.finalUrl} wide mono />
          </div>
        )}
      </section>

      <section className="resultsSection" aria-live="polite">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">02 / Discover</p>
            <h2>Site inventory</h2>
          </div>
          <div className="sectionTools">
            <code>scan_site</code>
            <code>list_pages</code>
          </div>
        </div>

        <form className="scanForm" onSubmit={onSiteSubmit}>
          <label htmlFor="site-url">Public site URL</label>
          <div className="inputRow">
            <input
              id="site-url"
              name="site-url"
              type="url"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              placeholder="https://example.com"
              required
            />
            <button type="submit" disabled={siteLoading}>
              {siteLoading ? "Scanning…" : "Scan sitemap"}
            </button>
          </div>
        </form>

        {siteError && <div className="error" role="alert">{siteError}</div>}

        {!siteResult ? (
          <div className="emptyState siteEmptyState">
            <p>Scan a site to discover its sitemap and public page URLs.</p>
          </div>
        ) : (
          <>
            <div className="resultsGrid siteSummary">
              <ResultCard
                label="Sitemap found"
                value={siteResult.summary.sitemapFound ? "Yes" : "No"}
              />
              <ResultCard
                label="Pages discovered"
                value={String(siteResult.summary.pagesDiscovered)}
              />
              <ResultCard
                label="Sitemap type"
                value={siteResult.summary.sitemapType}
              />
              <ResultCard
                label="Sitemaps processed"
                value={String(siteResult.summary.sitemapsProcessed)}
              />
              <ResultCard
                label="Sitemap URL"
                value={siteResult.summary.sitemapUrl}
                wide
                mono
              />
              <ResultCard
                label="Result status"
                value={siteResult.summary.truncated ? "Bounded limit reached" : "Complete"}
                wide
              />
            </div>

            <div className="pageListHeading">
              <h3>Discovered pages</h3>
              <span>{siteResult.pages.length} URLs</span>
            </div>
            <ol className="pageList">
              {siteResult.pages.map((page) => (
                <li key={page.url}>
                  <code>{page.url}</code>
                  {page.lastModified && <time>{page.lastModified}</time>}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section className="resultsSection" aria-live="polite">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">03 / Check</p>
            <h2>Link health</h2>
          </div>
          <code>find_broken_links</code>
        </div>

        <form className="scanForm" onSubmit={onBrokenLinksSubmit}>
          <label htmlFor="link-url">Public site URL</label>
          <div className="inputRow">
            <input
              id="link-url"
              name="link-url"
              type="url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://example.com"
              required
            />
            <button type="submit" disabled={linkLoading}>
              {linkLoading ? "Checking…" : "Check links"}
            </button>
          </div>
        </form>

        {linkError && <div className="error" role="alert">{linkError}</div>}

        {!linkResult ? (
          <div className="emptyState siteEmptyState">
            <p>Check a bounded sample of internal page links for verified HTTP failures.</p>
          </div>
        ) : (
          <>
            <div className="resultsGrid siteSummary">
              <ResultCard
                label="Broken links"
                value={String(linkResult.brokenLinksFound)}
              />
              <ResultCard
                label="Links checked"
                value={String(linkResult.linksChecked)}
              />
              <ResultCard
                label="Source pages fetched"
                value={String(linkResult.sourcePagesFetched)}
              />
              <ResultCard
                label="Unverified links"
                value={String(linkResult.unverifiedLinks)}
              />
              <ResultCard
                label="Result status"
                value={linkResult.truncated ? "Bounded sample" : "Complete sample"}
                wide
              />
            </div>

            {linkResult.brokenLinks.length ? (
              <>
                <div className="pageListHeading">
                  <h3>Verified broken links</h3>
                  <span>{linkResult.brokenLinks.length} URLs</span>
                </div>
                <ol className="pageList">
                  {linkResult.brokenLinks.map((link) => (
                    <li key={link.url}>
                      <code>{link.status} · {link.url}</code>
                      <time>
                        Found on {link.sourcePages.length} sampled source
                        {link.sourcePages.length === 1 ? "" : "s"}
                      </time>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="emptyState siteEmptyState">
                <p>No verified 4xx/5xx internal links were found in the bounded sample.</p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="resultsSection" aria-live="polite">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">04 / Plan</p>
            <h2>Migration readiness</h2>
          </div>
          <code>create_migration_plan</code>
        </div>

        <form className="scanForm" onSubmit={onMigrationSubmit}>
          <label htmlFor="migration-url">Public site URL</label>
          <div className="inputRow">
            <input
              id="migration-url"
              name="migration-url"
              type="url"
              value={migrationUrl}
              onChange={(event) => setMigrationUrl(event.target.value)}
              placeholder="https://example.com"
              required
            />
            <button type="submit" disabled={migrationLoading}>
              {migrationLoading ? "Planning…" : "Create migration plan"}
            </button>
          </div>
        </form>

        {migrationError && (
          <div className="error" role="alert">{migrationError}</div>
        )}

        {!migrationResult ? (
          <div className="emptyState siteEmptyState">
            <p>Build a bounded migration baseline from sitemap and page metadata.</p>
          </div>
        ) : (
          <>
            <div className="resultsGrid siteSummary">
              <ResultCard
                label="Pages discovered"
                value={String(migrationResult.pagesDiscovered)}
              />
              <ResultCard
                label="Priority pages inspected"
                value={String(migrationResult.priorityPagesInspected)}
              />
              <ResultCard
                label="Risks found"
                value={String(migrationResult.riskCount)}
              />
              <ResultCard
                label="Inventory"
                value={
                  migrationResult.inventoryTruncated
                    ? "Bounded / incomplete"
                    : "Within limits"
                }
              />
            </div>

            <div className="pageListHeading">
              <h3>Migration actions</h3>
              <span>{migrationResult.actions.length} steps</span>
            </div>
            <ol className="pageList">
              {migrationResult.actions.map((item, index) => (
                <li key={`${item.priority}-${index}`}>
                  <code>{item.priority.toUpperCase()} · {item.action}</code>
                  <time>{item.reason}</time>
                </li>
              ))}
            </ol>

            <div className="pageListHeading">
              <h3>Detected risks</h3>
              <span>{migrationResult.risks.length}</span>
            </div>
            {migrationResult.risks.length ? (
              <ol className="pageList">
                {migrationResult.risks.map((risk, index) => (
                  <li key={`${risk.code}-${risk.url ?? "site"}-${index}`}>
                    <code>{risk.level.toUpperCase()} · {risk.code}</code>
                    <time>
                      {risk.url ? `${risk.url} · ` : ""}
                      {risk.detail}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="emptyState siteEmptyState">
                <p>No migration risks were detected in the bounded sample.</p>
              </div>
            )}
          </>
        )}
      </section>

      <footer>
        <span>SiteScope · WebMCP Challenge 2026</span>
        <span className="footerKitoki">
          Built by Kitoki<span className="footerKitokiDot">.</span>
        </span>
      </footer>
    </main>
  );
}

function ResultCard({
  label,
  value,
  wide = false,
  mono = false
}: {
  label: string;
  value: string | null;
  wide?: boolean;
  mono?: boolean;
}) {
  return (
    <article className={wide ? "resultCard resultCardWide" : "resultCard"}>
      <span>{label}</span>
      <strong className={mono ? "mono" : undefined}>{value || "Not found"}</strong>
    </article>
  );
}
