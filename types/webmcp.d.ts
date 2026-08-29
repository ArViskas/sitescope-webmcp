export {};

declare global {
  interface WebMCPToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations?: Record<string, boolean>;
    execute: (input: { url: string }) => Promise<unknown>;
  }

  interface ModelContext {
    registerTool: (tool: WebMCPToolDefinition) => void;
    unregisterTool?: (name: string) => void;
  }

  interface Document {
    modelContext?: ModelContext;
  }
}
