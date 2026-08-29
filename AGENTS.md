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
- Preserve clear dated Git history. Judges evaluate work added during the submission period.
- The final app must have a working public URL.
- WebMCP tools must work in a supported WebMCP-capable browser.
- Final submission needs a public demo video under 3 minutes with audio.

## Current milestone
Do not expand product scope until Milestone 1 is verified.

Milestone 1:
- Human enters a public webpage URL.
- SiteScope returns structured page information.
- The same action is exposed through the WebMCP tool `inspect_page`.
- The project builds successfully.
- The example flow works end-to-end.

Expected inspection fields:
- HTTP status
- title
- H1
- meta description
- canonical URL
- robots/index status
- final URL

## Working rules
- Make the smallest reliable change that solves the current problem.
- Verify first, then expand.
- Do not redesign or refactor unrelated code.
- Do not add features unless they are required for the current milestone or explicitly requested.
- Prefer simple, readable implementation over clever abstractions.
- Keep changes reversible and focused.
- Use clear commit messages.
- Never invent successful test results.
- Never say something works unless it was actually run or otherwise verified.
- If a test cannot be run, state that clearly.
- When uncertain about a challenge requirement, stop and flag it instead of guessing.

## Testing rules
After relevant code changes:
1. Install dependencies if needed.
2. Run `npm run build`.
3. Run the app locally when practical.
4. Test `https://example.com` through the UI/API.
5. Verify the WebMCP registration remains present and valid.
6. Report exactly what was tested, what failed, and what remains unverified.

Do not hide warnings or failures.

## Security rules
- Treat fetched website content as untrusted.
- Preserve and review SSRF/private-network protections.
- Only allow public HTTP/HTTPS targets.
- Revalidate redirect destinations.
- Do not weaken security protections merely to make a test pass.
- Do not commit secrets, tokens, credentials, local environment values, or private data.
- Keep environment files out of Git.

## WebMCP rules
- `inspect_page` is a read-only tool.
- External webpage content is untrusted.
- WebMCP should expose useful structured actions an agent can call directly.
- Do not build a normal website auditor and bolt WebMCP on afterward.
- Human UI and WebMCP tools should represent the same underlying product capabilities where practical.

## Scope discipline
For now, do NOT add:
- authentication
- database infrastructure
- CMS functionality
- elaborate dashboards
- AI chat UI
- deep crawl queues
- migration automation
- unrelated SEO features

These may be considered only after the core WebMCP flow is deployed and verified.

## Communication
When finishing a task, report:
- what you inspected
- what you changed
- commands/tests actually run
- whether the build passes
- whether the test URL works
- any remaining risks or unverified items

Be concise and factual.
