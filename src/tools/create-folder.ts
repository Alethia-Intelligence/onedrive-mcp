import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

export function registerCreateFolder(server: McpServer, client: GraphClient): void {
  server.tool(
    "create_folder",
    "Create a new folder in OneDrive",
    {
      name: z.string().describe("Name for the new folder"),
      parent_path: z
        .string()
        .optional()
        .default("/")
        .describe("Path of the parent folder (e.g., '/Documents'). Defaults to root."),
      conflict_behavior: z
        .enum(["rename", "fail", "replace"])
        .optional()
        .default("rename")
        .describe("Behavior when a folder with the same name exists"),
    },
    async ({ name, parent_path, conflict_behavior }) => {
      try {
        const parentPath = parent_path === "/" ? "" : parent_path;
        let endpoint: string;

        if (parentPath) {
          // Resolve parent to get its ID
          const parent = await client.get<DriveItem>(
            `/me/drive/root:${parentPath}`
          );
          endpoint = `/me/drive/items/${parent.id}/children`;
        } else {
          endpoint = `/me/drive/root/children`;
        }

        const folder = await client.post<DriveItem>(endpoint, {
          name,
          folder: {},
          "@microsoft.graph.conflictBehavior": conflict_behavior,
        });

        // Invalidate cache for parent path
        if (parentPath) {
          client.invalidateCache(new RegExp(parentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        } else {
          client.invalidateCache(/\/me\/drive\/root\/children/);
        }

        const text =
          `## Folder Created\n\n` +
          `**${folder.name}**\n` +
          `ID: \`${folder.id}\`\n` +
          `Path: ${folder.parentReference?.path?.replace("/drive/root:", "") || "/"}/${folder.name}\n` +
          (folder.webUrl ? `Web URL: ${folder.webUrl}` : "");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
