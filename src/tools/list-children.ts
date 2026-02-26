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

function formatChild(item: DriveItem, index: number): string {
  const icon = item.folder ? "Folder" : "File";
  const modified = item.lastModifiedDateTime
    ? new Date(item.lastModifiedDateTime).toLocaleDateString()
    : "—";
  const sizeOrCount = item.folder
    ? `${item.folder.childCount} items`
    : formatSize(item.size);
  return `${index}. **${item.name}** (${icon}) — ${sizeOrCount} · Modified: ${modified}`;
}

export function registerListChildren(server: McpServer, client: GraphClient): void {
  server.tool(
    "list_children",
    "List files and folders in a OneDrive directory",
    {
      path: z
        .string()
        .optional()
        .describe("Folder path (e.g. 'Documents/Reports'). Omit for root."),
      item_id: z
        .string()
        .optional()
        .describe("Folder item ID. Alternative to path."),
      limit: z
        .number()
        .min(1)
        .max(200)
        .optional()
        .default(50)
        .describe("Maximum number of items (1-200)"),
    },
    async ({ path, item_id, limit }) => {
      try {
        let endpoint: string;
        let label: string;

        if (item_id) {
          endpoint = `/me/drive/items/${item_id}/children`;
          label = `item ${item_id}`;
        } else if (path) {
          endpoint = `/me/drive/root:/${path}:/children`;
          label = `/${path}`;
        } else {
          endpoint = "/me/drive/root/children";
          label = "/";
        }

        const data = await client.get<GraphPagedResponse<DriveItem>>(
          endpoint,
          { $top: limit },
          2 * 60 * 1000
        );

        if (!data.value.length) {
          return { content: [{ type: "text" as const, text: `No items found in ${label}.` }] };
        }

        const lines = [`## Contents of ${label}\n`];
        lines.push(
          data.value.map((item, i) => formatChild(item, i + 1)).join("\n")
        );
        lines.push(`\n*${data.value.length} item(s)*`);

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
