"use client";

import { FormEvent, useEffect, useState } from "react";

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

export default function Home() {
  const [url, setUrl] = useState("https://example.com");
  const [result, setResult] = useState<Inspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [webMcpDetected, setWebMcpDetected] = useState(false);

  useEffect(() => {
    const modelContext = document.modelContext;
    setWebMcpDetected(Boolean(modelContext?.registerTool));

    if (!modelContext?.registerTool) return;

    const tool = {
      name: "inspect_page",
      description:
        "Inspect a public webpage and return its HTTP status, title, H1, meta description, canonical URL, robots directive, and index status.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Absolute public webpage URL beginning with http:// or https://"
          }
        },
        required: ["url"],
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true
      },
      execute: async (
        { url: toolUrl }: { url: string },
        { signal }: { signal: AbortSignal }
      ) => inspect(toolUrl, signal)
    };

    const controller = new AbortController();
    void modelContext.registerTool(tool, { signal: controller.signal }).catch(() => {
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

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark" aria-hidden="true">S</span>
          <span>SiteScope</span>
        </div>
        <span className={webMcpDetected ? "status statusOk" : "status"}>
          <span className="statusDot" />
          {webMcpDetected ? "WebMCP detected" : "Standard browser"}
        </span>
      </header>

      <section className="hero">
        <p className="eyebrow">Website intelligence for humans + agents</p>
        <h1>Understand a website before you change it.</h1>
        <p className="lede">
          Inspect public page structure and metadata through the interface or let
          a WebMCP-capable agent call the same structured tools directly.
        </p>

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
      </section>

      <section className="resultsSection" aria-live="polite">
        <div className="sectionHeading">
          <div>
            <p className="eyebrow">Milestone 1</p>
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

      <footer>
        SiteScope prototype · WebMCP Challenge 2026
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
