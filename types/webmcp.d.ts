export {};

declare global {
  interface WebMCPToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: Record<string, boolean>;
    execute: (
      input: { url: string },
      options: { signal: AbortSignal }
    ) => Promise<unknown>;
  }

  interface ModelContext {
    registerTool: (
      tool: WebMCPToolDefinition,
      options?: { signal?: AbortSignal }
    ) => Promise<void>;
  }

  interface Document {
    modelContext?: ModelContext;
  }
}
