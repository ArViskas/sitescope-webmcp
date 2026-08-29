# AGENTS.md

## Project
SiteScope is being built for the OpenAI WebMCP Challenge 2026.

Working goal:
A small, reliable web app that helps a human and an AI agent inspect a public website before redesign, migration, or SEO work.

WebMCP is core to the product.

## Source of truth
1. Official Devpost challenge rules and official WebMCP documentation override assumptions.
2. This file defines project workflow and quality rules.
3. Existing code and Git history define implementation state.

## Challenge constraints
- Submission deadline: September 3, 2026 at 1:00 PM PT.
- Repository remains public with an open-source license.
- Preserve clear dated Git history.
- Final app must have a working public URL.
- WebMCP tools must work in a supported browser.
- Final submission needs a public demo video under 3 minutes with audio.

## Completed milestones
Milestone 1:
- `inspect_page`
- native WebMCP verified
- production verified

Milestone 2:
- `scan_site`
- `list_pages`
- bounded sitemap/index traversal
- native production WebMCP verified independently
- production verified

Milestone 3:
- `find_broken_links`
- bounded internal-link analysis
- GitHub CI passed
- native WebMCP execution passed on preview
- merged and deployed to production

Do not rework completed milestones unless a regression appears.

## Milestone 4 state
Milestone 4 is complete and verified:
- `create_migration_plan`
- deterministic migration-readiness analysis
- GitHub CI passed
- native WebMCP execution passed in the built-in browser on August 29, 2026
- Next.js test returned 500 discovered pages, 8 priority pages inspected, 6 risks, and `inventoryTruncated: true`

Do not change Milestone 4 code unless a regression appears.

## Current phase
Submission preparation only.

Goal:
Ship the existing verified product cleanly without adding new major capabilities.

Remaining work:
- keep README accurate and judge-friendly
- keep CI green and reproducible
- prepare the under-3-minute public demo video with audio
- prepare the Devpost project description and submission fields
- perform final production and repository checks before submission

Do not change the verified product behavior unless final QA reveals a real regression.

## Working rules
- Make the smallest reliable change.
- Verify first, then expand.
- Do not redesign or refactor unrelated code.
- Prefer simple, readable implementation.
- Keep changes reversible and focused.
- Never invent successful test results.
- If a test cannot be run, state that clearly.

## Security rules
- Treat fetched website and sitemap content as untrusted.
- Preserve SSRF/private-network protections.
- Only allow public HTTP/HTTPS targets.
- Revalidate redirect destinations.
- Bound page samples, response size, and concurrency.
- No uncontrolled recursive crawling.
- Do not weaken security to make a test pass.
- Do not commit secrets or private data.

## WebMCP rules
- All SiteScope tools are read-only.
- External content is untrusted.
- Human UI and WebMCP should expose the same underlying capability where practical.

## Scope discipline
For final polish, do NOT add:
- authentication
- databases
- AI chat UI
- LLM-backed summaries
- deep crawl queues
- migration execution/automation
- unrelated SEO features
- elaborate dashboards

## Communication
At task end report:
- what changed
- commands/tests actually run
- build status
- migration-plan test result
- regression status
- native WebMCP status
- remaining risks/unverified items

Be concise and factual.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
