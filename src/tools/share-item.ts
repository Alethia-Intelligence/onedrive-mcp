import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem, Permission } from "../types/onedrive.js";

export function registerShareItem(server: McpServer, client: GraphClient): void {
  server.tool(
    "share_item",
    "Create a sharing link for a file or folder in OneDrive",
    {
      item_id: z
        .string()
        .optional()
        .describe("The drive item ID. Either item_id or path is required."),
      path: z
        .string()
        .optional()
        .describe("Path to the item (e.g., '/Documents/file.txt'). Either path or item_id is required."),
      type: z
        .enum(["view", "edit"])
        .describe("Type of sharing link: 'view' for read-only, 'edit' for read-write"),
      scope: z
        .enum(["anonymous", "organization"])
        .optional()
        .default("anonymous")
        .describe("Scope of the link: 'anonymous' for anyone, 'organization' for org members only"),
      expiration: z
        .string()
        .optional()
        .describe("Expiration date for the link in ISO 8601 format (e.g., '2025-12-31T23:59:59Z')"),
    },
    async ({ item_id, path, type, scope, expiration }) => {
      try {
        if (!item_id && !path) {
          return {
            content: [{ type: "text" as const, text: "Error: Either item_id or path must be provided." }],
            isError: true as const,
          };
        }

        // Resolve item_id from path if needed
        let resolvedId = item_id;
        let itemName = "";
        if (path) {
          const item = await client.get<DriveItem>(`/me/drive/root:${path}`);
          resolvedId = item.id;
          itemName = item.name;
        } else if (item_id) {
          const item = await client.get<DriveItem>(`/me/drive/items/${item_id}`);
          itemName = item.name;
        }

        const body: Record<string, unknown> = { type, scope };
        if (expiration) {
          body.expirationDateTime = expiration;
        }

        const permission = await client.post<Permission>(
          `/me/drive/items/${resolvedId}/createLink`,
          body
        );

        const linkUrl = permission.link?.webUrl || "(link not available)";
        const text =
          `## Sharing Link Created\n\n` +
          `**${itemName}**\n` +
          `Type: ${type} · Scope: ${scope}\n` +
          (expiration ? `Expires: ${expiration}\n` : "") +
          `\nLink: ${linkUrl}`;

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
