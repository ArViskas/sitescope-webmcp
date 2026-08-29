# SiteScope

SiteScope is a WebMCP-powered website audit and migration assistant for humans and AI agents.

## Milestones 1–2

SiteScope currently supports three shared actions:

- A human can enter a public webpage URL and inspect its basic structure.
- A WebMCP-capable agent can call the same `inspect_page` tool directly.
- A human or agent can discover `/sitemap.xml`, traverse a bounded sitemap
  index, and retrieve a structured public page list through `scan_site` and
  `list_pages`.

The current inspection returns:

- HTTP status
- title
- H1
- meta description
- canonical URL
- robots directive
- index/noindex status
- final URL after redirects

## WebMCP

The browser-facing app registers `inspect_page`, `scan_site`, and `list_pages`
as read-only tools. External page and sitemap content is marked as untrusted.

The registration pattern is:

```js
document.modelContext.registerTool({
  name: "inspect_page",
  description: "Inspect a public webpage and return structured page metadata.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" }
    },
    required: ["url"]
  },
  execute: async ({ url }) => {
    // Calls SiteScope's page-inspection endpoint.
  }
});
```

Sitemap scanning is bounded to 10 sitemap documents, two index levels, 500
page URLs, and 6 MB per sitemap response.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Safety

SiteScope only accepts public HTTP/HTTPS URLs. The server rejects local/private network targets and re-validates redirect destinations before fetching them.

## License

MIT
