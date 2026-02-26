import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

export function registerUploadFile(server: McpServer, client: GraphClient): void {
  server.tool(
    "upload_file",
    "Upload a text file to OneDrive",
    {
      parent_path: z
        .string()
        .describe("Folder path to upload into (e.g., '/Documents')"),
      filename: z.string().describe("Name for the file (e.g., 'notes.txt')"),
      content: z.string().describe("Text content of the file"),
      conflict_behavior: z
        .enum(["rename", "fail", "replace"])
        .optional()
        .default("rename")
        .describe("Behavior when a file with the same name exists"),
    },
    async ({ parent_path, filename, content, conflict_behavior }) => {
      try {
        const folderPath = parent_path === "/" ? "" : parent_path;
        const filePath = folderPath ? `${folderPath}/${filename}` : filename;

        const item = await client.put<DriveItem>(
          `/me/drive/root:/${filePath}:/content?@microsoft.graph.conflictBehavior=${conflict_behavior}`,
          content,
          "text/plain"
        );

        // Invalidate parent folder cache
        if (folderPath) {
          client.invalidateCache(new RegExp(folderPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        } else {
          client.invalidateCache(/\/me\/drive\/root\/children/);
        }

        const text =
          `## File Uploaded\n\n` +
          `**${item.name}**\n` +
          `ID: \`${item.id}\`\n` +
          `Size: ${item.size ?? 0} bytes\n` +
          `Path: ${item.parentReference?.path?.replace("/drive/root:", "") || "/"}/${item.name}\n` +
          (item.webUrl ? `Web URL: ${item.webUrl}` : "");

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
