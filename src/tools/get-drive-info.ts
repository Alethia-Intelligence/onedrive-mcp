import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GraphClient } from "../api/client.js";
import { formatError } from "../utils/errors.js";
import type { Drive } from "../types/onedrive.js";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatPercentage(used: number, total: number): string {
  if (total === 0) return "0%";
  return `${((used / total) * 100).toFixed(1)}%`;
}

export function registerGetDriveInfo(server: McpServer, client: GraphClient): void {
  server.tool(
    "get_drive_info",
    "Get information about the user's OneDrive including storage quota",
    {},
    async () => {
      try {
        const drive = await client.get<Drive>(
          "/me/drive",
          undefined,
          5 * 60 * 1000
        );

        const lines = ["## OneDrive Information\n"];

        if (drive.name) {
          lines.push(`- **Name:** ${drive.name}`);
        }

        lines.push(`- **Drive Type:** ${drive.driveType}`);
        lines.push(`- **ID:** \`${drive.id}\``);

        if (drive.owner?.user) {
          lines.push(`- **Owner:** ${drive.owner.user.displayName}`);
        }

        if (drive.webUrl) {
          lines.push(`- **Web URL:** ${drive.webUrl}`);
        }

        if (drive.quota) {
          const q = drive.quota;
          lines.push("");
          lines.push("### Storage Quota\n");
          lines.push(`- **Total:** ${formatSize(q.total)}`);
          lines.push(`- **Used:** ${formatSize(q.used)} (${formatPercentage(q.used, q.total)})`);
          lines.push(`- **Remaining:** ${formatSize(q.remaining)}`);
          lines.push(`- **Deleted:** ${formatSize(q.deleted)}`);
          lines.push(`- **State:** ${q.state}`);
        }

        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
