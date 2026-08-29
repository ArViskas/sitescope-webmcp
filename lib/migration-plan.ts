import { inspectPublicPage, type PageInspection } from "@/lib/inspect";
import { listSitePages, type SitemapPage } from "@/lib/sitemap";

const MAX_PRIORITY_PAGES = 8;
const INSPECT_CONCURRENCY = 4;

export type MigrationRisk = {
  level: "high" | "medium";
  code:
    | "inventory_truncated"
    | "page_unreachable"
    | "current_redirect"
    | "missing_title"
    | "missing_h1"
    | "missing_meta_description"
    | "missing_canonical"
    | "canonical_mismatch"
    | "noindex";
  url: string | null;
  detail: string;
};

export type MigrationPageEvidence = {
  url: string;
  status: number | null;
  finalUrl: string | null;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  canonical: string | null;
  indexStatus: "index" | "noindex" | null;
  inspectionError: string | null;
};

export type MigrationAction = {
  priority: "critical" | "high" | "medium";
  action: string;
  reason: string;
};

export type MigrationPlan = {
  requestedUrl: string;
  siteOrigin: string;
  pagesDiscovered: number;
  inventoryTruncated: boolean;
  priorityPagesSelected: number;
  priorityPagesInspected: number;
  riskCount: number;
  risks: MigrationRisk[];
  priorityPages: MigrationPageEvidence[];
  actions: MigrationAction[];
  recommendedFollowUpTools: string[];
  limits: {
    maxPriorityPages: number;
    inspectConcurrency: number;
  };
};

function pathnameDepth(url: string) {
  return new URL(url).pathname.split("/").filter(Boolean).length;
}

function firstPathSegment(url: string) {
  return new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
}

function selectRepresentativePages(
  pages: SitemapPage[],
  fallbackUrl: string
): string[] {
  const candidates = pages.length
    ? pages.map((page) => page.url)
    : [fallbackUrl];

  const sorted = [...new Set(candidates)].sort((left, right) => {
    const depthDifference = pathnameDepth(left) - pathnameDepth(right);
    if (depthDifference) return depthDifference;

    const lengthDifference =
      new URL(left).pathname.length - new URL(right).pathname.length;
    if (lengthDifference) return lengthDifference;

    return left.localeCompare(right);
  });

  const selected: string[] = [];
  const usedSegments = new Set<string>();

  const root = sorted.find((url) => pathnameDepth(url) === 0);
  if (root) selected.push(root);

  for (const url of sorted) {
    if (selected.includes(url)) continue;

    const segment = firstPathSegment(url);
    if (segment && !usedSegments.has(segment)) {
      selected.push(url);
      usedSegments.add(segment);
    }

    if (selected.length >= MAX_PRIORITY_PAGES) return selected;
  }

  for (const url of sorted) {
    if (!selected.includes(url)) selected.push(url);
    if (selected.length >= MAX_PRIORITY_PAGES) break;
  }

  return selected;
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += size) {
    results.push(
      ...(await Promise.all(items.slice(index, index + size).map(worker)))
    );
  }

  return results;
}

function toEvidence(
  url: string,
  inspection: PageInspection | null,
  inspectionError: string | null
): MigrationPageEvidence {
  if (!inspection) {
    return {
      url,
      status: null,
      finalUrl: null,
      title: null,
      h1: null,
      metaDescription: null,
      canonical: null,
      indexStatus: null,
      inspectionError
    };
  }

  return {
    url,
    status: inspection.status,
    finalUrl: inspection.finalUrl,
    title: inspection.title,
    h1: inspection.h1,
    metaDescription: inspection.metaDescription,
    canonical: inspection.canonical,
    indexStatus: inspection.indexStatus,
    inspectionError
  };
}

function collectRisks(
  evidence: MigrationPageEvidence[],
  inventoryTruncated: boolean
): MigrationRisk[] {
  const risks: MigrationRisk[] = [];

  if (inventoryTruncated) {
    risks.push({
      level: "high",
      code: "inventory_truncated",
      url: null,
      detail:
        "The sitemap inventory reached SiteScope's bounded limit, so the migration inventory is incomplete."
    });
  }

  for (const page of evidence) {
    if (page.inspectionError || page.status === null || page.status >= 400) {
      risks.push({
        level: "high",
        code: "page_unreachable",
        url: page.url,
        detail:
          page.inspectionError ??
          `The sampled page returned HTTP ${page.status ?? "unknown"}.`
      });
      continue;
    }

    if (page.finalUrl && page.finalUrl !== page.url) {
      risks.push({
        level: "high",
        code: "current_redirect",
        url: page.url,
        detail: `The current URL resolves to ${page.finalUrl}; preserve or intentionally replace this redirect behavior.`
      });
    }

    if (!page.title) {
      risks.push({
        level: "medium",
        code: "missing_title",
        url: page.url,
        detail: "No page title was found on this sampled page."
      });
    }

    if (!page.h1) {
      risks.push({
        level: "medium",
        code: "missing_h1",
        url: page.url,
        detail: "No H1 was found on this sampled page."
      });
    }

    if (!page.metaDescription) {
      risks.push({
        level: "medium",
        code: "missing_meta_description",
        url: page.url,
        detail: "No meta description was found on this sampled page."
      });
    }

    if (!page.canonical) {
      risks.push({
        level: "medium",
        code: "missing_canonical",
        url: page.url,
        detail: "No canonical URL was found on this sampled page."
      });
    } else {
      const canonical = new URL(page.canonical);
      const current = new URL(page.finalUrl ?? page.url);
      if (
        canonical.hostname.toLowerCase() !== current.hostname.toLowerCase() ||
        canonical.pathname !== current.pathname
      ) {
        risks.push({
          level: "high",
          code: "canonical_mismatch",
          url: page.url,
          detail: `Canonical points to ${page.canonical}; verify this is intentional before migration.`
        });
      }
    }

    if (page.indexStatus === "noindex") {
      risks.push({
        level: "high",
        code: "noindex",
        url: page.url,
        detail:
          "This sampled page is noindex; preserve that intentionally or change it explicitly."
      });
    }
  }

  return risks;
}

function buildActions(
  pagesDiscovered: number,
  inventoryTruncated: boolean,
  risks: MigrationRisk[]
): MigrationAction[] {
  const actions: MigrationAction[] = [
    {
      priority: "critical",
      action: "Preserve the current public URL inventory before changing routes.",
      reason: `SiteScope discovered ${pagesDiscovered} sitemap URLs${inventoryTruncated ? " within its bounded limit" : ""}.`
    },
    {
      priority: "critical",
      action:
        "Create an explicit old-URL to new-URL redirect map for every path that will change.",
      reason:
        "URL preservation and redirects are the main defense against migration traffic and backlink loss."
    },
    {
      priority: "high",
      action:
        "Carry forward titles, H1s, meta descriptions, canonicals, and index directives for important pages.",
      reason:
        "Sampled metadata provides a baseline that can be compared before and after launch."
    },
    {
      priority: "high",
      action:
        "Run find_broken_links before launch and repeat it after the migrated site is live.",
      reason:
        "Broken internal links should be detected separately with SiteScope's bounded link checker."
    },
    {
      priority: "medium",
      action:
        "Publish and verify the migrated sitemap, then re-check representative pages after launch.",
      reason:
        "A post-launch inventory check confirms that important URLs remain discoverable and indexable."
    }
  ];

  if (risks.some((risk) => risk.code === "inventory_truncated")) {
    actions.unshift({
      priority: "critical",
      action:
        "Export or crawl the complete site inventory before migration; do not rely only on this bounded sample.",
      reason:
        "The current sitemap inventory exceeded SiteScope's safety limit and is incomplete."
    });
  }

  if (risks.some((risk) => risk.code === "current_redirect")) {
    actions.push({
      priority: "high",
      action: "Document existing redirects before replacing hosting or routing.",
      reason:
        "Current redirect behavior was observed on sampled URLs and can be lost during migration."
    });
  }

  if (risks.some((risk) => risk.code === "noindex")) {
    actions.push({
      priority: "high",
      action: "Review every noindex decision before launch.",
      reason:
        "Sampled pages currently contain noindex directives that should not change accidentally."
    });
  }

  if (risks.some((risk) => risk.code === "canonical_mismatch")) {
    actions.push({
      priority: "high",
      action: "Resolve canonical mismatches before or during migration.",
      reason:
        "Sampled canonical URLs do not match their current resolved page paths."
    });
  }

  return actions;
}

export async function createMigrationPlan(rawUrl: string): Promise<MigrationPlan> {
  const pageList = await listSitePages(rawUrl);
  const selectedUrls = selectRepresentativePages(
    pageList.pages,
    pageList.summary.requestedUrl
  );

  const priorityPages = await inBatches(
    selectedUrls,
    INSPECT_CONCURRENCY,
    async (url) => {
      try {
        return toEvidence(url, await inspectPublicPage(url), null);
      } catch (error) {
        return toEvidence(
          url,
          null,
          error instanceof Error ? error.message : "Inspection failed."
        );
      }
    }
  );

  const risks = collectRisks(priorityPages, pageList.summary.truncated);

  return {
    requestedUrl: pageList.summary.requestedUrl,
    siteOrigin: pageList.summary.siteOrigin,
    pagesDiscovered: pageList.summary.pagesDiscovered,
    inventoryTruncated: pageList.summary.truncated,
    priorityPagesSelected: selectedUrls.length,
    priorityPagesInspected: priorityPages.filter(
      (page) => page.inspectionError === null
    ).length,
    riskCount: risks.length,
    risks,
    priorityPages,
    actions: buildActions(
      pageList.summary.pagesDiscovered,
      pageList.summary.truncated,
      risks
    ),
    recommendedFollowUpTools: [
      "find_broken_links",
      "inspect_page",
      "scan_site"
    ],
    limits: {
      maxPriorityPages: MAX_PRIORITY_PAGES,
      inspectConcurrency: INSPECT_CONCURRENCY
    }
  };
}
