import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem, GraphPagedResponse } from "../types/onedrive.js";

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatItem(item: DriveItem, index: number): string {
  const type = item.folder ? "Folder" : "File";
  const path = item.parentReference?.path?.replace("/drive/root:", "") || "/";
  const modified = item.lastModifiedDateTime
    ? new Date(item.lastModifiedDateTime).toLocaleDateString()
    : "—";
  return (
    `${index}. **${item.name}** (${type})\n` +
    `   Path: ${path} · Size: ${formatSize(item.size)} · Modified: ${modified}`
  );
}

export function registerSearchFiles(server: McpServer, client: GraphClient): void {
  server.tool(
    "search_files",
    "Search for files and folders in OneDrive by name or content",
    {
      query: z.string().describe("Search query string"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Maximum number of results (1-50)"),
    },
    async ({ query, limit }) => {
      try {
        const data = await client.get<GraphPagedResponse<DriveItem>>(
          `/me/drive/root/search(q='${encodeURIComponent(query)}')`,
          { $top: limit },
          3 * 60 * 1000
        );

        if (!data.value.length) {
          return { content: [{ type: "text" as const, text: `No results found for "${query}".` }] };
        }

        const lines = [`## Search Results for "${query}"\n`];
        lines.push(
          data.value.map((item, i) => formatItem(item, i + 1)).join("\n\n")
        );
        lines.push(`\n*Showing ${data.value.length} result(s)*`);

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
