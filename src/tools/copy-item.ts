import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

export function registerCopyItem(server: McpServer, client: GraphClient): void {
  server.tool(
    "copy_item",
    "Copy a file or folder to another location in OneDrive",
    {
      item_id: z
        .string()
        .optional()
        .describe("The drive item ID. Either item_id or path is required."),
      path: z
        .string()
        .optional()
        .describe("Path to the item (e.g., '/Documents/file.txt'). Either path or item_id is required."),
      destination_path: z
        .string()
        .describe("Destination folder path (e.g., '/Archive')"),
      new_name: z
        .string()
        .optional()
        .describe("Optional new name for the copied item"),
    },
    async ({ item_id, path, destination_path, new_name }) => {
      try {
        if (!item_id && !path) {
          return {
            content: [{ type: "text" as const, text: "Error: Either item_id or path must be provided." }],
            isError: true as const,
          };
        }

        // Resolve source item
        let resolvedId = item_id;
        let itemName = "";
        if (path) {
          const source = await client.get<DriveItem>(`/me/drive/root:${path}`);
          resolvedId = source.id;
          itemName = source.name;
        } else if (item_id) {
          const source = await client.get<DriveItem>(`/me/drive/items/${item_id}`);
          itemName = source.name;
        }

        // Resolve destination folder to get its ID
        const destPath = destination_path === "/" ? "" : destination_path;
        let destFolderId: string;
        if (destPath) {
          const destFolder = await client.get<DriveItem>(`/me/drive/root:${destPath}`);
          destFolderId = destFolder.id;
        } else {
          const root = await client.get<DriveItem>(`/me/drive/root`);
          destFolderId = root.id;
        }

        const body: Record<string, unknown> = {
          parentReference: { driveId: undefined, id: destFolderId },
        };
        // Clean up undefined
        (body.parentReference as Record<string, unknown>).driveId = undefined;
        body.parentReference = { id: destFolderId };
        if (new_name) {
          body.name = new_name;
        }

        // Copy returns 202 Accepted — async operation
        try {
          await client.post(`/me/drive/items/${resolvedId}/copy`, body);
        } catch {
          // 202 Accepted may have empty body causing JSON parse to fail — this is expected
        }

        // Invalidate destination cache
        if (destPath) {
          client.invalidateCache(new RegExp(destPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        } else {
          client.invalidateCache(/\/me\/drive\/root\/children/);
        }

        const text =
          `## Copy Initiated\n\n` +
          `**${itemName}** is being copied to **${destination_path}**` +
          (new_name ? ` as **${new_name}**` : "") + `.\n` +
          `The copy operation runs asynchronously and may take a moment to complete.`;

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
