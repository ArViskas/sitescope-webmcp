# AGENTS.md

## Project
SiteScope is being built for the OpenAI WebMCP Challenge 2026.

Working goal:
A small, reliable web app that helps a human and an AI agent inspect a public website before redesign, migration, or SEO work.

The WebMCP capability is core to the product, not a decorative add-on.

## Source of truth
1. Official Devpost challenge rules and official WebMCP documentation override assumptions.
2. This file defines the project workflow and quality rules.
3. Existing code and Git history define the current implementation state.

## Challenge constraints
- Submission deadline: September 3, 2026 at 1:00 PM PT.
- Repository must remain public.
- Keep an open-source license in the repository.
- Preserve clear dated Git history.
- The final app must have a working public URL.
- WebMCP tools must work in a supported WebMCP-capable browser.
- Final submission needs a public demo video under 3 minutes with audio.

## Verified milestone
Milestone 1 is complete and should not be reworked unless a regression appears.

Milestone 1 verified end-to-end:
- Human page inspection works.
- `inspect_page` works through native WebMCP.
- Production deployment works at https://sitescope-webmcp.vercel.app.

## Milestone 2 state
Milestone 2 implementation is complete and deployed:
- `scan_site`
- `list_pages`
- bounded sitemap/index traversal
- human sitemap UI
- production deployment

The only remaining Milestone 2 verification is one fresh native production `list_pages` execution when browser usage limits allow it. Do not change Milestone 2 code unless that verification exposes a real bug.

## Current branch goal
This branch prepares Milestone 3 without changing production/main.

Milestone 3 capability:
- `find_broken_links`

Goal:
A human and WebMCP-capable agent can run a small, bounded check for broken internal page links discovered from sitemap pages.

Required behavior:
- Start from the existing safe sitemap/page-list capability.
- Inspect only a small bounded sample of source pages.
- Extract only internal HTTP/HTTPS page links.
- Check only a bounded number of unique targets.
- Report broken HTTP targets (4xx/5xx) with source pages.
- Report unverified/request-failure counts separately; do not falsely call them broken.
- Reuse existing SSRF/private-network protections.
- Keep `inspect_page`, `scan_site`, and `list_pages` unchanged unless a regression requires a minimal fix.

## Working rules
- Make the smallest reliable change that solves the current problem.
- Verify first, then expand.
- Do not redesign or refactor unrelated code.
- Prefer simple, readable implementation over clever abstractions.
- Keep changes reversible and focused.
- Use clear commit messages.
- Never invent successful test results.
- Never say something works unless it was actually run or otherwise verified.
- If a test cannot be run, state that clearly.
- When uncertain about a challenge requirement, stop and flag it instead of guessing.

## Testing rules
After relevant code changes:
1. Run `npm run build`.
2. Re-test `inspect_page` with `https://example.com`.
3. Re-test sitemap functionality.
4. Test broken-link analysis on a controlled or known public target where results can be verified.
5. Verify WebMCP registration remains present and valid.
6. Do not claim native production WebMCP execution until it is actually tested.

## Security rules
- Treat fetched website and sitemap content as untrusted.
- Preserve SSRF/private-network protections.
- Only allow public HTTP/HTTPS targets.
- Revalidate redirect destinations.
- Bound source pages, target links, response size, and concurrency.
- Do not use uncontrolled recursive crawling.
- Do not weaken security protections to make a test pass.
- Do not commit secrets, credentials, local environment values, or private data.

## WebMCP rules
- `inspect_page`, `scan_site`, `list_pages`, and `find_broken_links` are read-only tools.
- External content is untrusted.
- Human UI and WebMCP tools should represent the same underlying capabilities where practical.

## Scope discipline
For Milestone 3, do NOT add:
- migration plan generation
- AI summaries
- authentication
- databases
- elaborate dashboards
- AI chat UI
- deep crawl queues
- unrelated SEO features

## Communication
When finishing a task, report:
- what changed
- commands/tests actually run
- whether the build passes
- broken-link test results
- regression status for existing tools
- remaining risks/unverified items

Be concise and factual.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
