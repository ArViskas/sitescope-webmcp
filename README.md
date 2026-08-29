# SiteScope

SiteScope is a WebMCP-powered website inspection and migration-readiness tool for humans and AI agents.

**Live app:** https://sitescope-webmcp.vercel.app

It turns a public website into a small set of structured, read-only capabilities that can be used either through the human interface or directly by a WebMCP-capable agent.

## Why SiteScope

Website redesign and migration work usually starts with the same questions:

- What pages exist?
- Which URLs matter?
- What metadata and index directives are already in place?
- Are there broken internal links?
- What should be preserved before routes, hosting, or CMS structure change?

SiteScope exposes those tasks as WebMCP tools, so an agent can inspect the live web directly instead of relying on copied reports, screenshots, or a separate integration.

## WebMCP tools

| Tool | What it does |
| --- | --- |
| `inspect_page` | Returns status, title, H1, meta description, canonical URL, robots/index status, and final URL. |
| `scan_site` | Discovers and summarizes a public site's sitemap structure. |
| `list_pages` | Returns a bounded structured list of public URLs discovered from sitemaps. |
| `find_broken_links` | Checks a bounded sample of internal links and reports verified 4xx/5xx targets with source pages. |
| `create_migration_plan` | Builds a deterministic migration-readiness plan from sitemap inventory and representative page metadata. |

All tools are registered as read-only WebMCP tools and treat fetched web content as untrusted.

## Human + agent workflow

SiteScope follows one simple flow:

1. **Inspect** - understand an individual page.
2. **Discover** - map the site's public URL inventory.
3. **Check** - identify verified broken internal links in a bounded sample.
4. **Plan** - turn the evidence into migration risks and concrete preservation actions.

The human interface exposes the same underlying capabilities that the WebMCP tools use.

## WebMCP implementation

The browser-facing app registers tools through `document.modelContext.registerTool(...)`.

Example:

```ts
document.modelContext.registerTool(
  {
    name: "inspect_page",
    description:
      "Inspect a public webpage and return structured page metadata.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" }
      },
      required: ["url"],
      additionalProperties: false
    },
    annotations: {
      readOnlyHint: true,
      untrustedContentHint: true
    },
    execute: async ({ url }, { signal }) => {
      // Calls SiteScope's server-side inspection endpoint.
    }
  },
  { signal }
);
```

The same pattern is used for `scan_site`, `list_pages`, `find_broken_links`, and `create_migration_plan`.

## Safety and bounded execution

SiteScope only fetches public HTTP/HTTPS targets.

Server-side safeguards include:

- private/local network rejection
- IPv4, IPv6, and IPv4-mapped IPv6 checks
- DNS validation before outbound requests
- redirect destination re-validation
- response-size limits
- bounded sitemap traversal
- bounded page and link sampling
- bounded concurrency
- no uncontrolled recursive crawl
- external content treated as untrusted

Current sitemap limits include:

- up to 10 sitemap documents
- up to 2 sitemap-index levels
- up to 500 discovered page URLs
- up to 6 MB per sitemap response

Broken-link analysis is intentionally sampled and bounded rather than acting as an unrestricted crawler.

## Migration planning

`create_migration_plan` is deterministic and evidence-based. It does not call an LLM backend.

It uses the existing sitemap inventory and representative page inspections to flag migration concerns such as:

- incomplete/bounded inventory
- current redirects
- unreachable sampled pages
- missing titles
- missing H1s
- missing meta descriptions
- missing canonicals
- canonical mismatches
- noindex directives

It then returns prioritized migration actions and recommends follow-up SiteScope tools where useful.

## Verified challenge flow

During development, SiteScope was tested against real public websites including `example.com`, `nextjs.org`, and GOV.UK.

Verified native WebMCP executions include:

- `inspect_page`
- `list_pages`
- `find_broken_links`
- `create_migration_plan`

The production app is deployed on Vercel and the same codebase is covered by a GitHub Actions production build check.

## Local development

Requirements:

- Node.js 22 recommended
- npm

Install and run:

```bash
npm ci
npm run dev
```

Then open:

```text
http://localhost:3000
```

Production build:

```bash
npm run build
```

## Project structure

```text
app/
  api/inspect/route.ts    page inspection endpoint
  api/site/route.ts       sitemap, link, and migration endpoints
  page.tsx                human UI + WebMCP registration

lib/
  public-fetch.ts         bounded public-only fetch layer
  inspect.ts              page metadata inspection
  sitemap.ts              sitemap discovery and URL inventory
  broken-links.ts         bounded internal-link analysis
  migration-plan.ts       deterministic migration-readiness plan

types/
  webmcp.d.ts             WebMCP browser type declarations
```

## Design

SiteScope uses a restrained product UI inspired by the Kitoki visual system:

- Pearl canvas
- Ink typography
- Kitoki Red as a small signal color
- Washed Blue for secondary depth
- General Sans

The goal is to keep the interface closer to a serious web utility than a generic AI dashboard.

## License

MIT
