import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

export function registerUpdateItemMetadata(server: McpServer, client: GraphClient): void {
  server.tool(
    "update_item_metadata",
    "Rename or move a file/folder in OneDrive",
    {
      item_id: z
        .string()
        .optional()
        .describe("The drive item ID. Either item_id or path is required."),
      path: z
        .string()
        .optional()
        .describe("Path to the item (e.g., '/Documents/file.txt'). Either path or item_id is required."),
      new_name: z
        .string()
        .optional()
        .describe("New name for the item"),
      new_parent_path: z
        .string()
        .optional()
        .describe("Path to move the item to (e.g., '/Archive')"),
    },
    async ({ item_id, path, new_name, new_parent_path }) => {
      try {
        if (!item_id && !path) {
          return {
            content: [{ type: "text" as const, text: "Error: Either item_id or path must be provided." }],
            isError: true as const,
          };
        }

        if (!new_name && !new_parent_path) {
          return {
            content: [{ type: "text" as const, text: "Error: At least one of new_name or new_parent_path must be provided." }],
            isError: true as const,
          };
        }

        // Resolve item_id from path if needed
        let resolvedId = item_id;
        if (!resolvedId && path) {
          const existing = await client.get<DriveItem>(`/me/drive/root:${path}`);
          resolvedId = existing.id;
        }

        const body: Record<string, unknown> = {};
        if (new_name) {
          body.name = new_name;
        }
        if (new_parent_path) {
          // Resolve new parent folder to get its ID
          const parentPath = new_parent_path === "/" ? "" : new_parent_path;
          let newParentId: string;
          if (parentPath) {
            const newParent = await client.get<DriveItem>(`/me/drive/root:${parentPath}`);
            newParentId = newParent.id;
          } else {
            const root = await client.get<DriveItem>(`/me/drive/root`);
            newParentId = root.id;
          }
          body.parentReference = { id: newParentId };
        }

        const updated = await client.patch<DriveItem>(
          `/me/drive/items/${resolvedId}`,
          body
        );

        // Invalidate caches
        client.invalidateCache(new RegExp(resolvedId!));
        if (path) {
          client.invalidateCache(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
        if (new_parent_path) {
          client.invalidateCache(new RegExp(new_parent_path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }

        const actions: string[] = [];
        if (new_name) actions.push(`Renamed to **${new_name}**`);
        if (new_parent_path) actions.push(`Moved to **${new_parent_path}**`);

        const text =
          `## Item Updated\n\n` +
          `**${updated.name}**\n` +
          `ID: \`${updated.id}\`\n` +
          actions.join("\n") + "\n" +
          `Path: ${updated.parentReference?.path?.replace("/drive/root:", "") || "/"}/${updated.name}`;

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
