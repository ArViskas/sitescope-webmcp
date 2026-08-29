# SiteScope

SiteScope is a WebMCP-powered website audit and migration assistant for humans and AI agents.

## Milestone 1

The first end-to-end prototype supports one shared action:

- A human can enter a public webpage URL and inspect its basic structure.
- A WebMCP-capable agent can call the same `inspect_page` tool directly.

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

The browser-facing app registers an `inspect_page` tool using:

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
