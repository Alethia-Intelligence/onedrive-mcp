import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

export function registerUpdateFileContent(server: McpServer, client: GraphClient): void {
  server.tool(
    "update_file_content",
    "Update the content of an existing file in OneDrive",
    {
      path: z
        .string()
        .optional()
        .describe("Path to the file (e.g., '/Documents/notes.txt'). Either path or item_id is required."),
      item_id: z
        .string()
        .optional()
        .describe("The drive item ID of the file. Either path or item_id is required."),
      content: z.string().describe("New text content for the file"),
    },
    async ({ path, item_id, content }) => {
      try {
        if (!path && !item_id) {
          return {
            content: [{ type: "text" as const, text: "Error: Either path or item_id must be provided." }],
            isError: true as const,
          };
        }

        let endpoint: string;
        if (item_id) {
          endpoint = `/me/drive/items/${item_id}/content`;
        } else {
          endpoint = `/me/drive/root:${path}:/content`;
        }

        const item = await client.put<DriveItem>(endpoint, content, "text/plain");

        // Invalidate caches for the item and parent
        if (item_id) {
          client.invalidateCache(new RegExp(item_id));
        }
        if (path) {
          client.invalidateCache(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
        const parentPath = item.parentReference?.path?.replace("/drive/root:", "");
        if (parentPath) {
          client.invalidateCache(new RegExp(parentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }

        const text =
          `## File Content Updated\n\n` +
          `**${item.name}**\n` +
          `ID: \`${item.id}\`\n` +
          `Size: ${item.size ?? 0} bytes\n` +
          `Last Modified: ${item.lastModifiedDateTime || "—"}`;

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
