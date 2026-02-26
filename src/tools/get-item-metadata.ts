import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { DriveItem } from "../types/onedrive.js";

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatMetadata(item: DriveItem): string {
  const lines = [`## ${item.name}\n`];

  lines.push(`- **Type:** ${item.folder ? "Folder" : "File"}`);
  lines.push(`- **ID:** \`${item.id}\``);

  if (item.size !== undefined) {
    lines.push(`- **Size:** ${formatSize(item.size)}`);
  }

  if (item.file?.mimeType) {
    lines.push(`- **MIME Type:** ${item.file.mimeType}`);
  }

  if (item.folder) {
    lines.push(`- **Child Count:** ${item.folder.childCount}`);
  }

  if (item.parentReference?.path) {
    const path = item.parentReference.path.replace("/drive/root:", "") || "/";
    lines.push(`- **Parent Path:** ${path}`);
  }

  if (item.webUrl) {
    lines.push(`- **Web URL:** ${item.webUrl}`);
  }

  if (item.createdDateTime) {
    lines.push(`- **Created:** ${new Date(item.createdDateTime).toLocaleString()}`);
  }

  if (item.lastModifiedDateTime) {
    lines.push(`- **Modified:** ${new Date(item.lastModifiedDateTime).toLocaleString()}`);
  }

  if (item.createdBy?.user?.displayName) {
    lines.push(`- **Created By:** ${item.createdBy.user.displayName}`);
  }

  if (item.lastModifiedBy?.user?.displayName) {
    lines.push(`- **Modified By:** ${item.lastModifiedBy.user.displayName}`);
  }

  if (item.description) {
    lines.push(`- **Description:** ${item.description}`);
  }

  return lines.join("\n");
}

export function registerGetItemMetadata(server: McpServer, client: GraphClient): void {
  server.tool(
    "get_item_metadata",
    "Get detailed metadata for a file or folder in OneDrive",
    {
      path: z
        .string()
        .optional()
        .describe("Item path (e.g. 'Documents/report.docx'). Provide path or item_id."),
      item_id: z
        .string()
        .optional()
        .describe("Item ID. Alternative to path."),
    },
    async ({ path, item_id }) => {
      try {
        if (!path && !item_id) {
          return {
            content: [{ type: "text" as const, text: "Error: Provide either `path` or `item_id`." }],
            isError: true,
          };
        }

        const endpoint = item_id
          ? `/me/drive/items/${item_id}`
          : `/me/drive/root:/${path}`;

        const item = await client.get<DriveItem>(
          endpoint,
          undefined,
          2 * 60 * 1000
        );

        return { content: [{ type: "text" as const, text: formatMetadata(item) }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
