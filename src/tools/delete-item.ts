import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

export function registerDeleteItem(server: McpServer, client: GraphClient): void {
  server.tool(
    "delete_item",
    "Delete a file or folder from OneDrive (moves to recycle bin)",
    {
      path: z
        .string()
        .optional()
        .describe("Path to the item (e.g., '/Documents/old-file.txt'). Either path or item_id is required."),
      item_id: z
        .string()
        .optional()
        .describe("The drive item ID. Either path or item_id is required."),
    },
    async ({ path, item_id }) => {
      try {
        if (!path && !item_id) {
          return {
            content: [{ type: "text" as const, text: "Error: Either path or item_id must be provided." }],
            isError: true as const,
          };
        }

        // Resolve item to get ID and name
        let resolvedId = item_id;
        let itemName = item_id || "";
        let parentPath: string | undefined;

        if (path) {
          const existing = await client.get<DriveItem>(`/me/drive/root:${path}`);
          resolvedId = existing.id;
          itemName = existing.name;
          parentPath = existing.parentReference?.path?.replace("/drive/root:", "");
        } else if (item_id) {
          // Get item details for confirmation message
          const existing = await client.get<DriveItem>(`/me/drive/items/${item_id}`);
          itemName = existing.name;
          parentPath = existing.parentReference?.path?.replace("/drive/root:", "");
        }

        await client.delete(`/me/drive/items/${resolvedId}`);

        // Invalidate parent cache
        if (parentPath) {
          client.invalidateCache(new RegExp(parentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
        if (path) {
          client.invalidateCache(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }

        const text =
          `## Item Deleted\n\n` +
          `**${itemName}** has been moved to the recycle bin.\n` +
          `ID: \`${resolvedId}\``;

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
