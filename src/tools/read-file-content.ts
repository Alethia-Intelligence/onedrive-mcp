import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

const TEXT_MIME_PREFIXES = [
  "text/",
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-yaml",
  "application/x-sh",
  "application/csv",
  "application/sql",
];

function isTextFile(mimeType?: string): boolean {
  if (!mimeType) return false;
  return TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function registerReadFileContent(server: McpServer, client: GraphClient): void {
  server.tool(
    "read_file_content",
    "Read the content of a text file or get a download URL for binary files in OneDrive",
    {
      path: z
        .string()
        .optional()
        .describe("File path (e.g. 'Documents/notes.txt'). Provide path or item_id."),
      item_id: z
        .string()
        .optional()
        .describe("File item ID. Alternative to path."),
    },
    async ({ path, item_id }) => {
      try {
        if (!path && !item_id) {
          return {
            content: [{ type: "text" as const, text: "Error: Provide either `path` or `item_id`." }],
            isError: true,
          };
        }

        const metadataEndpoint = item_id
          ? `/me/drive/items/${item_id}`
          : `/me/drive/root:/${path}`;

        const item = await client.get<DriveItem>(metadataEndpoint);

        if (item.folder) {
          return {
            content: [{ type: "text" as const, text: `Error: "${item.name}" is a folder, not a file. Use list_children instead.` }],
            isError: true,
          };
        }

        const fileId = item.id;
        const mimeType = item.file?.mimeType;

        if (isTextFile(mimeType)) {
          const response = await client.getStream(`/me/drive/items/${fileId}/content`);
          const text = await response.text();

          const header =
            `## ${item.name}\n` +
            `*${mimeType} · ${formatSize(item.size)}*\n\n` +
            "---\n\n";

          return { content: [{ type: "text" as const, text: header + text }] };
        }

        const downloadUrl = item["@microsoft.graph.downloadUrl"];
        const lines = [
          `## ${item.name}\n`,
          `- **Type:** ${mimeType || "unknown"}`,
          `- **Size:** ${formatSize(item.size)}`,
          "",
          "This is a binary file. Content cannot be displayed as text.",
        ];

        if (downloadUrl) {
          lines.push(`\n**Download URL:** ${downloadUrl}`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
